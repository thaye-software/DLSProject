# API Gateway and Frontend: design

Date: 2026-11-09. Status: draft for approval.

## Intent

The microservice version (`microservices/`) has services but no way for a user to reach them: there is no gateway and no frontend. This adds both, following Architecture v3 in `CLAUDE.md` and the contracts in `microservices/docs/contracts/openapi.yaml`.

- **API Gateway**: the single HTTP entry point. Verifies the Supabase JWT, sets the identity headers the services already trust, and routes each path to its service.
- **Frontend**: the monolith's Next.js app (`monolith/limited-watches`), kept as-is visually, with its data layer swapped from direct database access to calls through the gateway.

Long term every page of the old app works against the microservices. This first slice wires only the pages backed by services that exist today.

## Goals

1. A user can browse and search watches, open a watch, check out and pay with Stripe, see their orders, chat with the shop, and send the contact form, all through the gateway.
2. An admin can see and answer conversations and change order status, through the gateway.
3. Gateway and frontend run in `microservices/docker-compose.yml` alongside the other services, and get Kubernetes manifests in `kubernetes/` like the others.

## Non-goals (this slice)

- Pages that need Users, Editorial or Auctions: settings, watchlist, admin watch/brand editors, admin exchange rate, avatars, blog. They stay in the app but show a "not available yet" state instead of breaking.
- Rate limiting, caching, request aggregation (BFF-style endpoints) in the gateway.
- Visual redesign of the frontend.
- An Authorization service. There is none in v3; login goes straight to Supabase Auth.

## Anti-goals (would make this a failure even if it works)

- A client can impersonate a user or admin by sending its own `X-User-*` headers.
- The gateway exposes `/internal/*` routes to the internet.
- The frontend still reads or writes a database directly (Drizzle, Supabase tables) for data a service owns.
- The gateway breaks the Stripe webhook by parsing/re-serialising its body (signature check needs the raw bytes).

## Decided

| Topic | Decision | Who |
|---|---|---|
| Scope | All pages eventually; now only those backed by existing services (Catalog, Orders, Payment, Search, Messaging, Emails) | User |
| Frontend tech | Keep the monolith's Next.js app; replace only the data layer | User |
| Admin role source | Gateway reads the role from the verified Supabase JWT claim `app_metadata.role`; missing/other value = regular user. `app_metadata` is writable only with the Supabase service key, so users cannot grant themselves admin. Admins get it set in Supabase (dashboard or service-key script). | User approved ("as long as it's secure") |
| Gateway tech | Node/TypeScript, Express 5 + `jose` (same stack as Orders/Catalog), in `microservices/gateway` | Claude's call |
| Browse filters | Keep only what `GET /search` supports (`q`, one `brand`, `availability`, `min_price`/`max_price`, paging). Hide multi-brand, size, year, condition, range sliders/counts. `/watches/limited` shows the normal listing until Search can filter on `limited`. Extending Search is a separate task. | User (accepted default) |
| Direct service access | Switch every `kubernetes/*/service.yaml` from `NodePort` to `ClusterIP` except gateway and frontend (tell the owning teammates). Compose keeps host ports for local dev; documented as a dev-only risk. | User (accepted default) |
| Currency | DKK only. Drop the monolith's geo-IP currency conversion and `currencyService`. | User (accepted default) |
| Signup | Hidden in this slice (Users not built; Supabase webhook isn't retried). Existing accounts log in. Re-enable when Users ships. | User (accepted default) |
| Watch page URL | `/watches/view/[id]/[slug]`: id for the Catalog lookup, slug cosmetic. No backend change. | User (accepted default) |
| Paths | Gateway keeps the contract paths unchanged (`/orders`, `/search`, ...), no `/api` prefix, matching `https://api.limitedwatches.dk/<path>` in `openapi.yaml` | Claude's call |

## API Gateway

### Behaviour per request

1. **Strip** any incoming `X-User-Id`, `X-User-Role`, `X-User-Email` headers. Always, on every route.
2. **Route** by path prefix (table below). Unknown path → 404 `application/problem+json`. Any `/internal/*` → 404.
3. **Authenticate** if the route needs it: verify `Authorization: Bearer <jwt>` with `jose` against the Supabase project's JWKS (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`), checking signature, `exp`, `iss` and `aud` (`authenticated`). Failure → 401 problem+json. On success set `X-User-Id` = `sub`, `X-User-Email` = `email`, `X-User-Role` = `app_metadata.role === "admin" ? "admin" : "customer"` (values from the contracts README).
   - Keys: JWKS (asymmetric signing keys) is the primary path, keys cached by `jose`. Optional `SUPABASE_JWT_SECRET` env enables HS256 verification for a local Supabase that still uses the legacy shared secret. (Claude's call.)
   - Routes with *optional* auth (see table): verify if a token is present (invalid token → 401), otherwise forward anonymously.
4. **Trace**: forward an incoming W3C `traceparent`, or generate one.
5. **Proxy** the request as a stream (method, path, query, body untouched, so the Stripe raw body survives) to the upstream. Upstream unreachable or timing out → 502/504 problem+json. Upstream for a not-yet-built service (Users) not configured → 503 problem+json.
6. **CORS**: allow the frontend origin(s) from config, with `Authorization` and `Content-Type` headers.

### Routes (from `openapi.yaml`)

| Path | Upstream | Auth |
|---|---|---|
| `/orders`, `/orders/*` | orders | required (status change is admin; Orders enforces it) |
| `/payments` | payment | required |
| `/webhooks/stripe` | payment | none (Payment checks `Stripe-Signature`) |
| `/webhooks/supabase/email-confirmed` | users (not built → 503) | none (Users checks shared secret) |
| `/contact` | emails (notif) | none |
| `/products/*` | catalog | optional |
| `/search` | search | optional |
| `/conversations`, `/conversations/*` | messaging | required |
| `/health` | gateway itself | none |

When Users, Editorial and Auctions arrive, they are one row each. Keep the table as data (a route list), not scattered handlers.

### Config (env)

`PORT`, `SUPABASE_URL` (for JWKS + issuer), optional `SUPABASE_JWT_SECRET`, one upstream URL per service (`ORDERS_URL`, `PAYMENT_URL`, `CATALOG_URL`, `SEARCH_URL`, `MESSAGING_URL`, `NOTIF_URL` (the emails service runs as `notif`), `USERS_URL` optional), `CORS_ORIGINS`. Validate with zod at startup, like the other services' `config.ts`.

### Tests

- Unit/integration (vitest + supertest, like the services): forged `X-User-*` headers are stripped; valid token → headers set; admin claim → `X-User-Role: admin`; `user_metadata.role = "admin"` does **not** make an admin; expired/wrong-issuer token → 401; `/internal/*` → 404; webhook body bytes reach upstream unchanged; unconfigured upstream → 503. Use a local JWKS (generated keypair) instead of real Supabase.

## Frontend

### Shape

- Copy `monolith/limited-watches` to `microservices/frontend`.
- Remove Drizzle, `src/database`, `drizzle.config.ts`, DB seed/migrate scripts, and server code that touches tables owned by a service.
- Keep: pages, components, Supabase Auth (login, forgot password, session via `@supabase/ssr`), Stripe.js, PostHog, Supabase Realtime for chat.
- Rewrite `src/services/*` as thin clients that call the gateway (`GATEWAY_URL`) with the user's Supabase access token as `Authorization: Bearer`. Map the contract shapes (e.g. `Money` = `amount_minor` + `currency`) to what components need, in the service layer, so components change as little as possible.
- Role in the UI (`SupabaseAuthContext`): read `app_metadata.role` from the Supabase session instead of the `users` table. Display only; the gateway is the real check.
- Errors: services answer `application/problem+json`; show its `title`/`detail`.

### Pages in this slice

| Page | Backed by |
|---|---|
| `/watches`, `/watches/[brandName]`, `/watches/limited`, home listings | Search `GET /search` |
| `/watches/view/[id]/[slug]` | Catalog `GET /products/{id}` |
| `/orders/checkout/infomation`, `/payment`, `/success` | Orders `POST /orders`, Payment `POST /payments`, Stripe.js confirm, Orders `GET /orders/{id}` |
| Order history, cancel | Orders `GET /orders`, `POST /orders/{id}/cancel` |
| Chat widget, `/admin/conversations` | Messaging `/conversations*` + Supabase Realtime |
| `/contact` | Emails `POST /contact` |
| `/login`, `/login/forgot-password` | Supabase Auth directly |
| `/about`, `/privacy`, `/terms` | static |

### Pages deferred (show "not available yet")

`/settings`, `/watchlist`, `/confirm-email-change`, `/admin/watches*`, `/admin/masterdata/brands`, `/admin/exchange-rate`, and the admin dashboard parts that need them.

## Deployment

- `microservices/gateway/docker-compose.yml` and `microservices/frontend/docker-compose.yml`, included from `microservices/docker-compose.yml`.
- Ports (Claude's call, avoiding 3000–3007 already used): gateway `8000`, frontend `3100`.
- `kubernetes/gateway/` and `kubernetes/frontend/` with deployment + service (+ secret where needed), following `kubernetes/orders/`. The gateway is the only service exposed outside the cluster besides the frontend.

## Claude's calls from the review

- **Price offers in chat** (`OfferPricePopover`, `offer-actions.ts`): "not available yet", since Orders answers 422 to any offer token until DECISIONS.md #3 is settled.
- **Live chat:** Messaging broadcasts `message_created` on `conversation:{id}`; the customer chat and an open admin conversation subscribe to it. The admin inbox list polls `GET /conversations` (no "conversation created" broadcast exists). Making Realtime channels private is out of scope; noted as a known gap.

## Left to the builder

- Proxy library (`http-proxy-middleware` vs. `fetch`/`undici` streaming) as long as bodies stream untouched.
- Whether Next.js calls the gateway from server components, the browser, or both (both need the user's access token; CORS covers the browser).
- Timeouts per upstream, log format.
- Exact component changes needed to fit contract shapes.

## Known gaps

- Not checked: whether the admin dashboard needs more from Orders than `GET /orders`, and whether checkout's saved-address prefill depends on Users.
- **Empty search index.** DECISIONS.md #5: until Catalog publishes `product_created`, Search returns nothing, so the browse pages will be empty end-to-end. Not blocked by this work, but the demo needs it.
