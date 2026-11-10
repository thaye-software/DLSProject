# Contract: Auth

Authoritative machine-readable version: `docs/contracts/openapi.yaml`, tag `Auth`. The gateway side is in `docs/contracts/README.md` §5.

## Events

None: Auth neither publishes nor consumes RabbitMQ messages.

## HTTP

### In: `GET /verify` (gateway only, internal network)

| Request header | |
|---|---|
| `Authorization` | `Bearer <Supabase access token>`, the client's own header |
| `X-Forwarded-Method` | the client's method |
| `X-Forwarded-Uri` | the client's path and query |

| Answer | Meaning |
|---|---|
| `200`, empty body, headers `X-User-Id` (uuid), `X-User-Email`, `X-User-Role` (`customer` \| `admin`) | Let the request through with these headers |
| `401 unauthorized` | No token, or it is invalid, expired, from another project or not a signed-in user's (`WWW-Authenticate: Bearer`) |
| `401 account_deleted` | The account was deleted |
| `403 profile_required` | No Users profile yet and the request is not `POST /users` |
| `503 signing_keys_unavailable` / `users_unavailable` | Supabase's keys or Users could not be reached |

Problems are RFC 9457 problem+json, with `instance` set to the client's path.

With `TOKEN_VERIFIER=fake` (local runs without Supabase only), the token is `fake:<user id>` or `fake:<user id>:<email>` instead of a Supabase access token. It is not checked, and Supabase is never called.

### Out

- Supabase: `GET <SUPABASE_URL>/auth/v1/.well-known/jwks.json` (public keys).
- Users: `GET /internal/users/{user_id}` with a service JWT (`iss` auth, `aud` users, at most 60 s). It returns `InternalUser`: `user_id`, `role`, `deleted`.

## Data

None. Roles are cached in memory for 30 s.
