# Limited Watches frontend

Next.js storefront and admin UI. It has no database or payment/email secrets: the server side talks only to the API gateway.

## Environment

Copy `.env.example` to `.env.local` (and to `.env` for Docker Compose).

| Variable | Where | Purpose |
| --- | --- | --- |
| `GATEWAY_URL` | runtime, server only | Gateway base URL (`http://localhost:8000`; `http://gateway:8000` in Compose/Kubernetes) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build time | Login and Realtime chat (straight to Supabase) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | build time | Stripe.js payment confirmation |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | build time | Analytics |

`NEXT_PUBLIC_*` values are baked into the bundle, so in Docker they are build args (Compose reads them from `.env`).

## Run

```
npm install
npm run dev        # http://localhost:3100
npm test
```

Whole stack: `docker compose -f ../docker-compose.yml up -d --build` (frontend on :3100, gateway on :8000).
Kubernetes: build `dls/frontend:local` with the `--build-arg NEXT_PUBLIC_...` values, `kubectl apply -f ../../kubernetes/frontend`, then open http://localhost:30100.

## How it talks to the gateway

Server components and actions call `gatewayFetch` (`src/lib/gateway.ts`), which adds the Supabase access token as a Bearer header and turns problem+json errors into `GatewayError`. The browser never calls the gateway directly; it only talks to Supabase (auth, chat), Stripe and PostHog.

## Not available yet

Pages for services without a gateway route show a "not available yet" notice. There is no signup link; accounts are created in Supabase.
