# Gateway

Public HTTP entry point. Verifies Supabase JWTs and routes requests to Search, Users, Editorial, Messaging, Catalog, Auctions, Orders, Payment and Notif/Email. There is no auth service: the frontend logs in directly with Supabase Auth, and the gateway only verifies the tokens it receives.

Design: `../../docs/superpowers/specs/2026-11-09-api-gateway-frontend-design.md`. Open questions: `../../DECISIONS.md`.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `8000` | Default 8000 |
| `SUPABASE_URL` | `https://<project>.supabase.co` | Required; trailing slash is removed |
| `SUPABASE_JWT_SECRET` | random 32+ characters | Optional; used to verify JWTs |
| `ORDERS_URL`, `PAYMENT_URL`, `CATALOG_URL`, `SEARCH_URL`, `MESSAGING_URL`, `NOTIF_URL`, `USERS_URL` | `http://orders:3000` | Upstream per service; unset means the service is not routed |
| `CORS_ORIGINS` | `http://localhost:3100,https://limitedwatches.dk` | Comma-separated |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Default 10000 |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
npm run dev     # tsx watch
npm test        # Vitest
```
