# Gateway

Public HTTP entry point. Verifies Supabase JWTs and routes requests to Search, Users, Editorial, Messaging, Catalog, Auctions, Orders, Payment and Notif/Email. There is no auth service: the frontend logs in directly with Supabase Auth, and the gateway only verifies the tokens it receives.

Design: `../../docs/superpowers/specs/2026-11-09-api-gateway-frontend-design.md`. Open questions: `../../DECISIONS.md`.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `8000` | Default 8000 |
| `SUPABASE_URL` | `https://<project>.supabase.co` | Required; trailing slash is removed |
| `SUPABASE_JWT_ISSUER` | `$SUPABASE_URL/auth/v1` | Optional. Exact `iss` to accept, when the gateway reaches Supabase on a different address than tokens name. Local Supabase in Docker: `SUPABASE_URL=http://host.docker.internal:55421`, `SUPABASE_JWT_ISSUER=http://127.0.0.1:55421/auth/v1` |
| `SUPABASE_JWT_SECRET` | unset (default) | Optional, normally leave unset. Enables HS256 verification for a local Supabase on the legacy secret. Anyone who knows it can forge admin tokens, so never set it to a placeholder or a value that is in git |
| `ORDERS_URL`, `PAYMENT_URL`, `CATALOG_URL`, `SEARCH_URL`, `MESSAGING_URL`, `NOTIF_URL`, `USERS_URL` | `http://orders:3000` | Upstream per service; unset means the service is not routed |
| `CORS_ORIGINS` | `http://localhost:3100,https://limitedwatches.dk` | Comma-separated |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Default 10000 |

Copy `.env.example` to `.env`; `.env` is gitignored.

Before `docker compose up` (the gateway is in the default compose profile): `cp .env.example .env` and fill in `SUPABASE_URL`, otherwise the gateway container crash-loops. Use `START_GATEWAY=false` to leave it out.

Dev-only risk: the other services still publish host ports in their compose files. Those ports bypass the gateway and trust forged `X-User-*` headers, so they are for local development only and must not be exposed.

## Running

```bash
npm install
npm run dev     # tsx watch
npm test        # Vitest
```
