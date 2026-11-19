# API Gateway and Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an API Gateway (`microservices/gateway`) that verifies Supabase JWTs and routes to the existing services, and a frontend (`microservices/frontend`) that is the monolith's Next.js app with its data layer swapped for gateway calls.

**Architecture:** The gateway is a small Express 5 app: a route table (data) maps path prefixes to upstream URLs and an auth mode; middleware strips client `X-User-*` headers, verifies the bearer token with `jose`, sets identity headers and streams the request to the upstream with `http-proxy-middleware`. The frontend keeps its pages and server actions; one server-only `gatewayFetch` replaces Drizzle, and each feature's `src/services/*` file becomes a thin gateway client that maps contract shapes to what components already use.

**Tech Stack:** Node 24, TypeScript, Express 5, jose 6, http-proxy-middleware 3, zod 4, vitest (gateway). Next.js 16, @supabase/ssr, Stripe.js, jest (frontend, as in the monolith).

**Spec:** `docs/superpowers/specs/2026-11-09-api-gateway-frontend-design.md`. Contracts: `microservices/docs/contracts/openapi.yaml` (schema and operation names below refer to it).

## Global Constraints

- Gateway paths are the contract paths unchanged (`/orders`, `/search`, ...), no `/api` prefix.
- Identity headers set by the gateway: `X-User-Id` = `sub`, `X-User-Email` = `email`, `X-User-Role` = `"admin"` if `app_metadata.role === "admin"` else `"customer"`. Never read `user_metadata`.
- Incoming `x-user-id`, `x-user-role`, `x-user-email` are deleted on every request, before anything else.
- `/internal/*` is never routed (404).
- Errors are RFC 9457 `application/problem+json` with `type` = `https://limitedwatches.dk/problems/<code>`.
- Request bodies are proxied as untouched byte streams (Stripe signature check). The gateway never mounts `express.json()`.
- Ports: gateway `8000`, frontend `3100`.
- Money is `{ amount_minor, currency }`; the frontend shows DKK only and does no currency conversion.
- Signup is hidden. Pages for Users/Editorial/Auctions show "not available yet".
- Watch page URL: `/watches/view/[id]/[slug]`.
- Follow `microservices/orders` for project layout, `config.ts` style, Dockerfile, compose and k8s manifests.

## Review Focus

1. **Path tricks reaching internal routes** (`/internal/reservations`, `/Internal/...`, `//internal/x`, `/orders/..%2Finternal/reservations`): all must 404 without contacting an upstream. Tested in Task 3.
2. **Upstream down** (service not started): gateway answers 502 problem+json quickly instead of hanging; frontend shows an error message, not the Next.js crash page. Tested in Task 3 and Task 5.
3. **Expired session in the frontend:** a server action with an expired/invalid token gets 401 from the gateway; the user is sent to `/login`, not shown a stack trace. Tested in Task 5.
4. **Algorithm confusion / junk tokens** (`alg: none`, an HS256 token when only JWKS is configured, `Bearer` with no token): 401. Tested in Task 2.
5. **Query strings with encoded and repeated params** (`/search?q=rolex%20sub&brand=omega&page=2`): reach the upstream byte-for-byte. Tested in Task 3.

---

### Task 1: Gateway scaffold and config

**Files:**
- Create: `microservices/gateway/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `.env.example`, `README.md`
- Create: `microservices/gateway/src/config.ts`
- Test: `microservices/gateway/test/unit/config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ServiceName = "orders" | "payment" | "catalog" | "search" | "messaging" | "notif" | "users";
  export type Config = {
    port: number;                       // PORT, default 8000
    supabaseUrl: string;                // SUPABASE_URL, http(s), trailing slash removed
    supabaseJwtSecret: string | null;   // SUPABASE_JWT_SECRET, optional, min 32 chars
    upstreams: Partial<Record<ServiceName, string>>; // ORDERS_URL, PAYMENT_URL, CATALOG_URL, SEARCH_URL, MESSAGING_URL, NOTIF_URL, USERS_URL; unset = absent
    corsOrigins: string[];              // CORS_ORIGINS, comma-separated, trimmed
    upstreamTimeoutMs: number;          // UPSTREAM_TIMEOUT_MS, default 10000
  };
  export function loadConfig(env: NodeJS.ProcessEnv): Config;
  ```

Copy `package.json` shape, `tsconfig*.json` and `vitest.config.ts` (unit project only) from `microservices/orders`, minus Prisma. Dependencies: `express`, `jose`, `http-proxy-middleware`, `zod`; dev: `vitest`, `tsx`, `typescript`, `@types/express`, `@types/node`.

- [ ] **Step 1: Write failing tests** in `test/unit/config.test.ts`:
  - `loads defaults`: env `{ SUPABASE_URL: "https://x.supabase.co" }` → `port === 8000`, `upstreams` deep-equals `{}`, `supabaseJwtSecret === null`, `upstreamTimeoutMs === 10000`, `corsOrigins` deep-equals `[]`.
  - `reads upstreams`: `ORDERS_URL: "http://orders:3000"` → `upstreams.orders === "http://orders:3000"`, `upstreams.users === undefined`.
  - `splits CORS_ORIGINS`: `"http://localhost:3100, https://limitedwatches.dk"` → `["http://localhost:3100", "https://limitedwatches.dk"]`.
  - `rejects a short SUPABASE_JWT_SECRET` (10 chars) → throws `/Invalid environment/`.
  - `rejects a missing SUPABASE_URL` → throws `/Invalid environment/`.
- [ ] **Step 2:** `cd microservices/gateway && npm install && npx vitest run test/unit/config.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `loadConfig` with a zod schema, same error format as `microservices/orders/src/config.ts`.
- [ ] **Step 4:** Same command → PASS; `npx tsc --noEmit` → no errors.
- [ ] **Step 5: Commit** `feat(gateway): scaffold and config`.

---

### Task 2: Token verification

**Files:**
- Create: `microservices/gateway/src/auth.ts`
- Test: `microservices/gateway/test/unit/auth.test.ts`, `microservices/gateway/test/support/tokens.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (options passed in).
- Produces:
  ```ts
  export type Identity = { userId: string; email: string; role: "admin" | "customer" };
  export type VerifyToken = (token: string) => Promise<Identity>; // rejects with InvalidTokenError
  export class InvalidTokenError extends Error {}
  export function createTokenVerifier(options: {
    supabaseUrl: string;        // issuer = `${supabaseUrl}/auth/v1`
    jwtSecret: string | null;   // enables HS256 when set
    jwks?: JWTVerifyGetKey;     // test seam; default createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  }): VerifyToken;
  ```
  `test/support/tokens.ts` exports `createTestKeys(): Promise<{ jwks: JWTVerifyGetKey; sign(claims: Record<string, unknown>, options?: { expiresIn?: string; issuer?: string; audience?: string }): Promise<string> }>` (ES256 keypair via `generateKeyPair`, `exportJWK`, `createLocalJWKSet`; defaults issuer `https://x.supabase.co/auth/v1`, audience `authenticated`, expiry `5m`) and `signHs256(secret: string, claims: Record<string, unknown>): Promise<string>`.

Approach: `decodeProtectedHeader(token).alg`; `HS256` → verify with the secret only if `jwtSecret` is set, otherwise reject; anything else → verify with `jwks` and `algorithms: ["ES256", "RS256"]`. Always check `issuer` and `audience: "authenticated"`. Require `sub` (uuid) and `email` (string) via zod. Wrap every error in `InvalidTokenError`.

- [ ] **Step 1: Write failing tests** in `test/unit/auth.test.ts`:
  - `accepts a valid ES256 token`: `{ sub: USER_ID, email: "a@b.dk", app_metadata: {} }` → `{ userId: USER_ID, email: "a@b.dk", role: "customer" }`.
  - `admin from app_metadata`: `app_metadata: { role: "admin" }` → `role: "admin"`.
  - `ignores user_metadata.role`: `user_metadata: { role: "admin" }` → `role: "customer"`.
  - `rejects expired` (`expiresIn: "-1m"`), `rejects wrong issuer`, `rejects wrong audience` → `InvalidTokenError`.
  - `rejects HS256 when no secret configured` → `InvalidTokenError`.
  - `accepts HS256 when secret configured` (same 32+ char secret) → identity.
  - `rejects alg none`: `` `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(claims))}.` `` → `InvalidTokenError`.
  - `rejects garbage`: `"not-a-jwt"` and `""` → `InvalidTokenError`.
  - `rejects missing email` → `InvalidTokenError`.
- [ ] **Step 2:** `npx vitest run test/unit/auth.test.ts` → FAIL.
- [ ] **Step 3:** Implement `createTokenVerifier`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5: Commit** `feat(gateway): verify Supabase JWTs`.

---

### Task 3: Route table, middleware and proxy

**Files:**
- Create: `microservices/gateway/src/routes.ts`, `microservices/gateway/src/problem.ts`, `microservices/gateway/src/app.ts`
- Test: `microservices/gateway/test/unit/routes.test.ts`, `microservices/gateway/test/unit/app.test.ts`, `microservices/gateway/test/support/upstream.ts`

**Interfaces:**
- Consumes: `Config`, `ServiceName` (Task 1); `VerifyToken`, `InvalidTokenError` (Task 2); `createTestKeys` (Task 2, tests).
- Produces:
  ```ts
  // routes.ts
  export type AuthMode = "required" | "optional" | "none";
  export type Route = { prefix: string; service: ServiceName; auth: AuthMode };
  export const ROUTES: readonly Route[];
  export function matchRoute(path: string): Route | null; // null for /internal/*, unknown and malformed paths
  // problem.ts: copy of microservices/orders/src/adapters/http/problem.ts (Problem, sendProblem)
  // app.ts
  export type AppDependencies = { config: Config; verifyToken: VerifyToken };
  export function createApp(deps: AppDependencies): express.Express;
  ```
  `test/support/upstream.ts` exports `startUpstream(): Promise<{ url: string; lastRequest(): { method: string; url: string; headers: IncomingHttpHeaders; body: Buffer } | null; close(): Promise<void> }>`: a `node:http` server that records the raw request and answers 200 `{"ok":true}`.

`ROUTES` (exact):

| prefix | service | auth |
|---|---|---|
| `/orders` | orders | required |
| `/payments` | payment | required |
| `/webhooks/stripe` | payment | none |
| `/webhooks/supabase/email-confirmed` | users | none |
| `/contact` | notif | none |
| `/products` | catalog | optional |
| `/search` | search | optional |
| `/conversations` | messaging | required |

`matchRoute`: take the path without query, `decodeURIComponent` (throws → null), lowercase, collapse repeated `/`; null if any segment is `..` or `.` or the first segment is `internal`; a prefix matches when the path equals it or continues with `/`. Matching uses the normalised path; the proxy forwards the original URL.

Request pipeline in `createApp` (order matters):
1. Disable `x-powered-by`. Delete `x-user-id`, `x-user-role`, `x-user-email` from `req.headers`.
2. CORS, hand-written: if `Origin` is in `config.corsOrigins`, set `Access-Control-Allow-Origin` to it, `Vary: Origin`, `Access-Control-Allow-Methods: GET,POST,PATCH,PUT,DELETE,OPTIONS`, `Access-Control-Allow-Headers: Authorization,Content-Type`; any `OPTIONS` → 204.
3. `GET /health` → 200 `{"status":"ok"}`.
4. `matchRoute(req.path)` null → 404 problem `not-found`.
5. No URL in `config.upstreams` for the route's service → 503 problem `service-unavailable`.
6. Auth: `required` with missing/invalid bearer → 401 problem `unauthorized`; `optional` with an invalid bearer → 401, with none → anonymous; `none` → no verification. On success set the three `x-user-*` headers.
7. `traceparent`: keep a valid incoming one (`/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/`), else set `00-${randomBytes(16).hex}-${randomBytes(8).hex}-01`.
8. Proxy: one `createProxyMiddleware({ target, changeOrigin: true, proxyTimeout: config.upstreamTimeoutMs })` per configured service, built at startup, picked per request from the matched route. Call it from a handler mounted **without a path** (`app.use(handler)`), so Express does not strip the prefix from `req.url`. `on.error`: timeout → 504 `gateway-timeout`, otherwise 502 `bad-gateway`.

- [ ] **Step 1: Write failing tests** in `test/unit/routes.test.ts`:
  - every prefix in the table, and a sub-path (`/orders/abc/cancel`, `/search?q=x`), maps to its service.
  - `/ordersx`, `/`, `/unknown` → null.
  - `/internal/reservations`, `/Internal/reservations`, `//internal/x`, `/orders/..%2Finternal/reservations`, `/orders/%E0%A4%A` → null.
- [ ] **Step 2: Write failing tests** in `test/unit/app.test.ts` (app on port 0 via `fetch`; tokens from `createTestKeys`; one `startUpstream()` configured as every upstream except `users`):
  - `strips forged identity headers on a public route`: `POST /contact` with `x-user-id: evil`, `x-user-role: admin` → upstream saw neither.
  - `sets identity headers from the token`: `GET /orders` with a customer token → upstream saw `x-user-id` = sub, `x-user-email`, `x-user-role: customer`.
  - `admin token sets admin role`.
  - `required route without token` → 401, `content-type` starts `application/problem+json`, `type` ends `/unauthorized`, upstream not called.
  - `required route with "Bearer " and no token` → 401.
  - `optional route without token` → 200, upstream saw no `x-user-*`.
  - `optional route with expired token` → 401.
  - `internal paths 404` for each path from Review Focus 1; upstream not called.
  - `unconfigured upstream`: `POST /webhooks/supabase/email-confirmed` → 503.
  - `forwards raw body untouched`: `POST /webhooks/stripe` body `'{"a":1,  "b":"ø"}'` with `stripe-signature: t=1,v1=x` → upstream body bytes equal the sent bytes; signature header present.
  - `forwards encoded and repeated query params`: `GET /search?q=rolex%20sub&brand=omega&page=2` → upstream `url` is exactly `/search?q=rolex%20sub&brand=omega&page=2`.
  - `keeps a valid traceparent` / `generates one when missing` (matches the regex).
  - `upstream down`: `SEARCH_URL` = `http://127.0.0.1:1` → `GET /search` answers 502 problem in under 2 s.
  - `CORS preflight`: allowed origin → 204 with `access-control-allow-origin` equal to it; other origin → header absent.
  - `GET /health` → 200.
- [ ] **Step 3:** `npx vitest run` → new tests FAIL.
- [ ] **Step 4:** Implement `routes.ts`, `problem.ts`, `app.ts`.
- [ ] **Step 5:** `npx vitest run && npx tsc --noEmit` → PASS.
- [ ] **Step 6: Commit** `feat(gateway): route, authenticate and proxy requests`.

---

### Task 4: Gateway runtime and deployment; close direct service access

**Files:**
- Create: `microservices/gateway/src/main.ts`, `microservices/gateway/Dockerfile`, `microservices/gateway/docker-compose.yml`
- Create: `kubernetes/gateway/deployment.yaml`, `kubernetes/gateway/service.yaml`, `kubernetes/gateway/secret.yaml`
- Modify: `microservices/docker-compose.yml` (include `gateway/docker-compose.yml`)
- Modify: every `kubernetes/*/service.yaml` and `kubernetes/*/*-service.yaml` that is `NodePort`: type → `ClusterIP`, remove `nodePort`
- Modify: `kubernetes/setupguide.txt` (gateway is the entry point; how to set an admin's `app_metadata.role` in Supabase)

**Interfaces:**
- Consumes: `loadConfig` (Task 1), `createTokenVerifier` (Task 2), `createApp` (Task 3).

`main.ts`: `loadConfig(process.env)` → `createApp({ config, verifyToken: createTokenVerifier({ supabaseUrl, jwtSecret }) })` → `listen(config.port)`; log the port and the configured upstream names.

Dockerfile: the orders one without Prisma, `EXPOSE 8000`, `CMD ["node", "dist/main.js"]`. Compose service `gateway`: `8000:8000`, optional `env_file: .env`, `ORDERS_URL: http://orders:3000`, `PAYMENT_URL: http://payment:3006`, `CATALOG_URL: http://catalog:3002`, `SEARCH_URL: http://search:3003`, `MESSAGING_URL: http://messaging:3004`, `NOTIF_URL: http://notif:3007`, `CORS_ORIGINS: http://localhost:3100`, healthcheck `wget -qO- http://localhost:8000/health`. K8s: deployment like `kubernetes/orders/deployment.yaml` (image `dls/gateway:local`, port 8000, `SUPABASE_URL`/`SUPABASE_JWT_SECRET` from `gateway-secret`, upstreams as the in-cluster service names and ports from each `kubernetes/*/service.yaml`); service `NodePort`, `nodePort: 30080`.

- [ ] **Step 1:** Write `main.ts`, Dockerfile, compose files. Run `docker compose -f microservices/docker-compose.yml up -d --build gateway orders search` → `curl -s localhost:8000/health` prints `{"status":"ok"}`; `curl -si localhost:8000/orders` → `401` with `application/problem+json`; `curl -si localhost:8000/internal/reservations` → `404`.
- [ ] **Step 2:** Write the k8s manifests; switch the others to `ClusterIP`. `kubectl apply --dry-run=client -R -f kubernetes/` → no errors; `grep -rln "NodePort" kubernetes/` → only `kubernetes/gateway/service.yaml`.
- [ ] **Step 3: Commit** `feat(gateway): docker, compose and k8s; services become ClusterIP` (message body says the other Services lost their NodePorts, so their owners see it).

---

### Task 5: Frontend copy, gateway client, data layer removal

**Files:**
- Create: `microservices/frontend/` as a copy of `monolith/limited-watches/` without `node_modules`, `.next`, `supabase-test`, `__tests__/integration`, and `.env*` other than `.env.example`
- Delete in the copy: `src/database/`, `drizzle.config.ts`, `src/app/api/` (currency, product-images, uploads and webhooks are services' jobs now), every file in `src/services/` (rewritten per feature in Tasks 6–8), `src/app/actions/location.ts`, `src/app/orders/offer-actions.ts`, `src/lib/resend/`, `src/lib/stripe/` (server-side Stripe); the `db:*` and `test:db:setup`/`supabase:*:test` scripts; the `drizzle-orm`, `drizzle-kit`, `postgres`, `stripe` and `resend` dependencies (check the exact names in `package.json`)
- Create: `src/lib/gateway.ts`, `src/lib/money.ts`, `src/components/NotAvailable.tsx`
- Modify: `src/context/SupabaseAuthContext.tsx` (role from `app_metadata`, no `users` lookup or avatar), `src/app/login/page.tsx` and `src/app/login/actions.ts` (signup removed), `package.json` (`dev`/`start` on `-p 3100`), `.env.example` (`GATEWAY_URL`, Supabase URL/anon key, Stripe publishable key, PostHog)
- Test: `__tests__/unit/gateway.test.ts`, `__tests__/unit/money.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/gateway.ts (first line: import "server-only")
  export type Problem = { type: string; title: string; status: number; detail?: string };
  export class GatewayError extends Error { status: number; problem: Problem | null }
  export async function gatewayFetch<T>(path: string, init?: {
    method?: string; body?: unknown; query?: Record<string, string | number | undefined>; auth?: boolean; // auth default true
  }): Promise<T>;
  // auth=true: access token from createClient() in src/lib/supabase/server; no session → GatewayError 401 without calling fetch.
  // Non-2xx → GatewayError with parsed problem+json (null if the body isn't one). fetch throws → GatewayError 502. 204 → undefined.
  export async function withLoginRedirect<T>(call: () => Promise<T>): Promise<T>; // GatewayError 401 → redirect("/login"); anything else rethrows
  // src/lib/money.ts
  export type Money = { amount_minor: number; currency: string };
  export function formatMoney(money: Money): string; // Intl.NumberFormat("da-DK", { style: "currency", currency }).format(amount_minor / 100)
  // src/components/NotAvailable.tsx
  export function NotAvailable({ feature }: { feature: string }): JSX.Element; // "<feature> is not available yet."
  ```

Every file that imported `@/services/*` or `@/database/*` (`grep -rlE "@/(services|database)" src`) is reduced in this task so the app builds:
- Deferred for good (render `<NotAvailable>`): `/settings`, `/watchlist`, `/confirm-email-change`, `/admin/watches*`, `/admin/masterdata/brands`, `/admin/exchange-rate`, and their actions.
- Rewired in Tasks 6–8 (render `<NotAvailable>` until then): watches pages, checkout pages, admin dashboard, admin conversations, chat.
- Removed from the UI: favorite button, offer popover, currency selector. Prices use `formatMoney`.

- [ ] **Step 1: Write failing tests** `__tests__/unit/gateway.test.ts` (mock `global.fetch`, `@/lib/supabase/server`, `next/navigation`, `server-only`; `GATEWAY_URL=http://gw`):
  - `sends bearer token and JSON body`: session token `"tok"`, `gatewayFetch("/orders", { method: "POST", body: { a: 1 } })` → fetch called with `http://gw/orders`, headers `authorization: Bearer tok` and `content-type: application/json`, body `{"a":1}`.
  - `builds query, skipping undefined`: `{ q: "rolex sub", page: 2, brand: undefined }` → URL `http://gw/search?q=rolex+sub&page=2`.
  - `auth=false sends no Authorization`.
  - `parses problem+json`: 409 with a Problem body → rejects with `GatewayError` `status 409`, `problem.title` set.
  - `network failure → 502`.
  - `no session with auth=true → 401, fetch not called`.
  - `withLoginRedirect` calls `redirect("/login")` on 401 and rethrows a 500.
  - `__tests__/unit/money.test.ts`: `formatMoney({ amount_minor: 11500000, currency: "DKK" })` contains `115.000,00` and `kr`.
- [ ] **Step 2:** `cd microservices/frontend && npm install && npx jest __tests__/unit` → new tests FAIL.
- [ ] **Step 3:** Copy, delete, implement `gateway.ts`, `money.ts`, `NotAvailable.tsx`, auth context, login and stubs.
- [ ] **Step 4:** `npx jest __tests__/unit && npm run lint && npm run build` → PASS; `grep -rnE "drizzle|@/database|@/services" src` → no matches; `grep -rn "signUp" src` → no matches.
- [ ] **Step 5: Commit** `feat(frontend): copy Next.js app, add gateway client, remove DB layer`.

---

### Task 6: Browse, search and watch page

**Files:**
- Create: `src/services/searchService.ts`, `src/services/productService.ts`
- Move: `src/app/watches/view/[watchSlug]/page.tsx` → `src/app/watches/view/[id]/[slug]/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/watches/page.tsx`, `src/app/watches/[brandName]/page.tsx`, `src/app/watches/limited/page.tsx`, `src/components/Watches/WatchesGrid.tsx`, `src/components/Watches/Filters/ProductFilterSheet.tsx`, `src/components/Navbar/SearchBar.tsx`, `src/components/Navbar/SearchResultsDialog.tsx`, `src/components/Navbar/BrandNavItem.tsx`, `src/app/sitemap.ts`
- Test: `__tests__/unit/searchService.test.ts`

(All paths under `microservices/frontend/`.)

**Interfaces:**
- Consumes: `gatewayFetch`, `GatewayError`, `formatMoney` (Task 5).
- Produces:
  ```ts
  // searchService.ts — SearchResults, ProductListing typed from openapi.yaml
  export type SearchFilters = { q?: string; brand?: string; availability?: string; minPriceDkk?: number; maxPriceDkk?: number; page?: number; pageSize?: number };
  export function toSearchQuery(filters: SearchFilters): Record<string, string | number | undefined>; // min_price/max_price in minor units (×100), page_size
  export async function searchProducts(filters: SearchFilters): Promise<SearchResults>; // GET /search, auth: false
  export function watchHref(listing: Pick<ProductListing, "product_id" | "slug">): string; // `/watches/view/${product_id}/${slug}`
  // productService.ts — ProductSummary from openapi.yaml
  export async function getProduct(id: string): Promise<ProductSummary | null>; // GET /products/{id}, auth: false; 404 → null
  ```

Filter sheet keeps text, single brand, availability, min/max price (DKK). Multi-brand, size, year, condition, range sliders and counts are removed. `/watches/limited` shows the normal listing (Search can't filter on `limited`); `/watches/[brandName]` passes `brand`. The watch page shows the `ProductSummary` fields (name, brand, model, price, availability, thumbnail); `notFound()` when null; if the URL slug differs from the product's, `redirect(watchHref(...))`. A failed search renders an error message in the grid, not a crash. The page is thin compared with the monolith's because `ProductSummary` has no description, gallery or specs. That's a contract gap, not something this task fixes.

- [ ] **Step 1: Write failing tests**: `toSearchQuery({ q: "sub", minPriceDkk: 1000, maxPriceDkk: 5000, pageSize: 24 })` → `{ q: "sub", min_price: 100000, max_price: 500000, page_size: 24 }` (others undefined); `watchHref({ product_id: "p1", slug: "rolex-sub" })` → `/watches/view/p1/rolex-sub`; `getProduct` returns null on `GatewayError` 404 and rethrows 500.
- [ ] **Step 2:** `npx jest __tests__/unit/searchService.test.ts` → FAIL.
- [ ] **Step 3:** Implement the services; rewire the listed pages and components.
- [ ] **Step 4:** `npx jest __tests__/unit && npm run build` → PASS. Manual, with compose (gateway, search, catalog) and `npm run dev`: `http://localhost:3100/watches` shows listings or an empty state (empty index until DECISIONS.md #5) with no error overlay; `/watches/view/<seeded product id>/x` redirects to the canonical slug.
- [ ] **Step 5: Commit** `feat(frontend): browse, search and watch page via gateway`.

---

### Task 7: Checkout, payment and orders

**Files:**
- Create: `src/services/orderService.ts`, `src/services/paymentService.ts`
- Modify: `src/app/orders/actions.ts`, `src/app/orders/checkout/infomation/page.tsx`, `src/app/orders/checkout/payment/page.tsx`, `src/app/orders/checkout/success/page.tsx`, `src/components/Orders/Info/BillingForm.tsx`, `src/components/Orders/Info/ShippingAndBillingForm.tsx`, `src/app/admin/page.tsx`, `src/app/admin/action.ts`
- Test: `__tests__/unit/orderService.test.ts`

(All paths under `microservices/frontend/`.)

**Interfaces:**
- Consumes: `gatewayFetch`, `withLoginRedirect`, `GatewayError` (Task 5).
- Produces:
  ```ts
  // orderService.ts — CreateOrderRequest, Order, OrderPage, UpdateOrderStatusRequest from openapi.yaml
  export async function createOrder(request: Omit<CreateOrderRequest, "offer_token">): Promise<Order>; // POST /orders with offer_token: null
  export async function getOrder(orderId: string): Promise<Order>;                                     // GET /orders/{id}
  export async function listOrders(page?: number): Promise<OrderPage>;                                 // GET /orders
  export async function cancelOrder(orderId: string): Promise<Order>;                                  // POST /orders/{id}/cancel
  export async function updateOrderStatus(orderId: string, body: UpdateOrderStatusRequest): Promise<Order>; // PATCH /orders/{id}/status
  // paymentService.ts — PaymentSession from openapi.yaml
  export async function createPayment(orderId: string): Promise<PaymentSession>;                       // POST /payments { order_id }
  ```

Flow: information page → server action `createOrder` → `redirect("/orders/checkout/payment?order=<id>")` → page calls `createPayment` and passes `client_secret` to the existing Stripe `<Elements>` → `stripe.confirmPayment` with `return_url` `/orders/checkout/success?order=<id>` → success page shows `getOrder`; while the order is still `RESERVED`, show "processing" (the webhook may land a moment later). Saved-address prefill is removed (Users isn't built). On a 409/422 problem (e.g. product unavailable), show `title`/`detail` on the form. Admin dashboard: order list with a status select calling `updateOrderStatus`; widgets that need missing services render `<NotAvailable>`. All server actions wrap calls in `withLoginRedirect`.

- [ ] **Step 1: Write failing tests** (mock `@/lib/gateway`): `createOrder` posts to `/orders` with `offer_token: null`; `createPayment("o1")` posts `{ order_id: "o1" }` to `/payments`; `updateOrderStatus` uses `PATCH /orders/o1/status`; `cancelOrder` uses `POST /orders/o1/cancel`.
- [ ] **Step 2:** `npx jest __tests__/unit/orderService.test.ts` → FAIL.
- [ ] **Step 3:** Implement the services, actions and pages.
- [ ] **Step 4:** `npx jest __tests__/unit && npm run build` → PASS. Manual with compose (gateway, orders, catalog, payment, rabbitmq), `stripe listen --forward-to localhost:8000/webhooks/stripe`, and a logged-in test user: order the seeded product, pay with test card `4242 4242 4242 4242` → success page moves from "processing" to the paid/confirmed status.
- [ ] **Step 5: Commit** `feat(frontend): checkout, payment and orders via gateway`.

---

### Task 8: Chat and admin conversations

**Files:**
- Create: `src/services/conversationService.ts`, `src/app/chat/actions.ts`
- Modify: `src/context/ChatContext.tsx`, `src/components/Chat/RealtimeChat.tsx`, `src/hooks/useRealtimeChat.tsx`, `src/hooks/useRealtimeConversations.ts`, `src/hooks/conversation-dashboard/*.ts`, `src/components/Admin/Conversations/ConversationDashboard.tsx`, `src/components/Admin/Sidebar/ConversationsLinkContent.tsx`, `src/app/admin/conversations/page.tsx`, the chat entry on the watch page
- Test: `__tests__/unit/conversationService.test.ts`

(All paths under `microservices/frontend/`.)

**Interfaces:**
- Consumes: `gatewayFetch`, `withLoginRedirect` (Task 5).
- Produces:
  ```ts
  // Conversation, ConversationList, ChatMessage, MessagePage from openapi.yaml
  export async function openConversation(productId: string): Promise<Conversation>;                  // POST /conversations
  export async function listConversations(): Promise<ConversationList>;                               // GET /conversations
  export async function listMessages(conversationId: string, before?: string): Promise<MessagePage>;  // GET /conversations/{id}/messages
  export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage>;      // POST /conversations/{id}/messages
  export async function markRead(conversationId: string): Promise<void>;                              // POST /conversations/{id}/read
  ```
  `src/app/chat/actions.ts` exposes the same five as server actions for client components.

Live updates: the browser Supabase client subscribes to broadcast channel `conversation:${id}`, event `message_created` (as in `microservices/messaging/src/adapters/realtime/supabase-broadcast.ts`), and appends the payload, de-duplicating by message id against messages this client just sent. The admin inbox list polls `listConversations` every 10 s. No direct Supabase table reads remain.

- [ ] **Step 1: Write failing tests** (mock `@/lib/gateway`): each function's method and path; `listMessages("c1", "2026-11-09T10:00:00Z")` puts `before` in `query`; `openConversation("p1")` body matches `OpenConversationRequest`.
- [ ] **Step 2:** `npx jest __tests__/unit/conversationService.test.ts` → FAIL.
- [ ] **Step 3:** Implement the service, actions, hooks and components.
- [ ] **Step 4:** `npx jest __tests__/unit && npm run build` → PASS. Manual: a customer opens chat on a watch and sends a message; an admin (account with `app_metadata.role = "admin"`) sees it in `/admin/conversations` within 10 s and replies; the customer sees the reply without reloading.
- [ ] **Step 5: Commit** `feat(frontend): chat and admin conversations via gateway`.

---

### Task 9: Contact form, frontend deployment, end-to-end check

**Files:**
- Modify: `microservices/frontend/src/app/contact/actions.ts`, `microservices/frontend/src/components/Contact/ContactButton.tsx`, `microservices/frontend/Dockerfile` (port 3100, no DB env), `microservices/frontend/README.md`, `microservices/docker-compose.yml` (include frontend)
- Create: `microservices/frontend/docker-compose.yml`, `kubernetes/frontend/deployment.yaml`, `kubernetes/frontend/service.yaml`

**Interfaces:**
- Consumes: `gatewayFetch` (Task 5).

Contact action: `gatewayFetch("/contact", { method: "POST", auth: false, body })` with a `ContactMessage` body; show problem `detail` on 4xx. Compose service `frontend`: `3100:3100`, `GATEWAY_URL: http://gateway:8000`, public Supabase/Stripe/PostHog env from `.env`. K8s: deployment `dls/frontend:local` on 3100 with `GATEWAY_URL: http://gateway:8000`; service `NodePort`, `nodePort: 30100`.

- [ ] **Step 1:** Implement the contact action; `npm run build` → PASS.
- [ ] **Step 2:** Compose and k8s files. `docker compose -f microservices/docker-compose.yml up -d --build` → all services healthy; `kubectl apply --dry-run=client -R -f kubernetes/` → no errors; `grep -rln "NodePort" kubernetes/` → only gateway and frontend.
- [ ] **Step 3: End-to-end check** at `http://localhost:3100`: browse, watch page, login, checkout with a test card, chat both ways, contact form (email arrives with a Resend test key), deferred pages show "not available yet", no signup link.
- [ ] **Step 4: Commit** `feat(frontend): contact form and deployment`.
