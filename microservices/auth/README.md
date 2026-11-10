# Auth

Forward-auth for the API Gateway. For every request to a protected route, the gateway asks Auth whether the caller is signed in. Auth answers with the user headers the services trust: `X-User-Id`, `X-User-Email` and `X-User-Role`. It is stateless, with no database and no RabbitMQ.

Auth issues no tokens. Login, signup and token refresh go from the frontend straight to Supabase Auth, which issues the access tokens. Auth only checks them.

Contracts: `contract.md` (summary) and `../docs/contracts/openapi.yaml` (tag `Auth`). The gateway's side is in `../docs/contracts/README.md` §5.

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `GET /verify` | Called by the gateway (nginx `auth_request`, Traefik `ForwardAuth`; any method is accepted). Reads `Authorization: Bearer <Supabase access token>`, `X-Forwarded-Method` and `X-Forwarded-Uri`. `200` with an empty body and `X-User-Id` / `X-User-Email` / `X-User-Role`, or a problem+json the gateway hands to the client (its `instance` is the client's path). |
| HTTP in | `GET /health` | `200` while the process runs. It doesn't check Users or Supabase, so an outage there doesn't get Auth restarted and its cache dropped. |
| HTTP out | Supabase `GET <SUPABASE_URL>/auth/v1/.well-known/jwks.json` | The project's public signing keys, cached by jose and fetched again when a token names an unknown key id, so key rotation needs nothing. |
| HTTP out | Users `GET /internal/users/{user_id}` | Service JWT with `iss` auth, `aud` users, 60 s, signed with `INTERNAL_JWT_SECRET`; 2 s timeout. |

**What `/verify` checks, in order:**

1. **A bearer token.** If there is none: `401 unauthorized`.
2. **The token itself.** The signature must match the project's keys: ES256 or RS256 from the JWKS, or HS256 with `SUPABASE_JWT_SECRET` for legacy projects. HS256 is rejected when no secret is set.
   - The claims must be: `iss` = `<SUPABASE_URL>/auth/v1`, `aud` = `authenticated`, `exp` not passed (5 s tolerance), `sub` a user id, `email` present, and `role` = `authenticated`. The `role` check rejects the anon and service-role keys.
   - Anything else is `401 unauthorized`, with the reason in `detail`.
   - If the signing keys can't be fetched: `503 signing_keys_unavailable`.
3. **The user in Users.**
   - Deleted: `401 account_deleted`. Their Supabase token stays valid until it expires, so this is where they are stopped.
   - No profile yet (signed up, `POST /users` not called): only `POST /users` passes, as `customer`; anything else is `403 profile_required`.
   - Users unreachable and nothing cached: `503 users_unavailable`.
4. **Otherwise `200`.** `X-User-Email` is the token's email, so it is the user's current Supabase email.

**Role cache.** A found user is kept for `ROLE_CACHE_TTL_MS` (30 s), so Users sees at most one lookup per user per 30 s. The trade-off is that a role change or account deletion takes up to 30 s to reach the gateway.
- "No profile" is never cached, so the request right after `POST /users` already passes.
- While Users is down, a cached user is still served for up to 5 minutes.
- Concurrent misses for one user share one call.
- At most 10 000 users are kept; the least recently fetched is dropped first.

**What the gateway must do:**
- Send every route except the public ones to `/verify`. The public ones are `GET /search`, `GET /products/{id}`, `GET /users/username-available`, `POST /contact` and the webhooks.
- Remove any `X-User-*` header the client sent.
- On `200`, copy the three headers onto the upstream request; otherwise, return Auth's response.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3001` | |
| `TOKEN_VERIFIER` | `supabase` | `fake` runs without a Supabase project (the local Kubernetes cluster): `Bearer fake:<user id>` or `fake:<user id>:<email>` signs in as that user without any check, and the email defaults to `<user id>@fake.invalid`. Never expose it to real clients |
| `SUPABASE_URL` | `https://xyz.supabase.co` | The project the tokens come from; required with `supabase` |
| `SUPABASE_JWT_SECRET` | | Legacy HS256 projects only; empty for asymmetric signing keys |
| `USERS_URL` | `http://users:3005` | Set by compose |
| `INTERNAL_JWT_SECRET` | random 32+ characters | The same as in `users/.env` |
| `ROLE_CACHE_TTL_MS` | `30000` | `0` turns the cache off |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
npm run dev          # tsx watch; needs Users running for role lookups
npm test             # Vitest (Node 24); a local fake Supabase JWKS and a stub Users stand in for the real ones
```
