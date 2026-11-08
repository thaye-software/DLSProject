# Contract: Users

Authoritative machine-readable versions: `docs/contracts/asyncapi.yaml` and `docs/contracts/openapi.yaml`. Notation: `?` may be null.

## Envelope (CloudEvents, every message)

| Field | Meaning |
|---|---|
| `specversion` | `"1.0"` |
| `id` | uuid, idempotency key (dedupe on it) |
| `source` | `/services/users` |
| `type` | event name, also the routing key |
| `time` | timestamp |
| `datacontenttype` | `"application/json"` |
| `subject` | the user id |
| `dataversion` | `1` |
| `correlationid` | the user id |
| `causationid` | `null` (a user action) |
| `data` | see below |

Queue per consumer: `<consumer>.user.events`, with a dead-letter queue `.dlq`.

## Publishes on `user.events`

| Event | Subject | `data` | Consumers |
|---|---|---|---|
| `user_deleted` | `user_id` | `user_id`, `version` (int ≥ 1, the aggregate version after the deletion), `deleted_at` | Orders, Messaging, Editorial, Auctions (anonymise, keep the id); Orders also cancels `RESERVED` orders; Catalog deletes favorites |

## Consumes

Nothing.

## HTTP

See `docs/contracts/openapi.yaml`, tag `Users`:
- Public via gateway: `POST /users`, `GET /users/username-available` (no login), `GET`/`PATCH`/`DELETE /users/me`, `PUT`/`DELETE /users/me/address`, `PUT /users/me/avatar`.
- Internal: `GET /internal/users/{user_id}`, Auth's role lookup for the gateway (`iss` auth).
- Inbound webhook: `POST /webhooks/supabase/email-confirmed`.

Outbound: Supabase Auth admin API (delete user, `display_name`) and Supabase Storage (bucket `avatars`).

### Types

- `UserRole`: `customer | admin`
- `UserAddress`: `address_line_1`, `address_line_2?`, `city`, `zip_code`, `state_province?`. The country is the profile's `country_code`.
- `User`: `user_id`, `username`, `email`, `first_name?`, `middle_name?`, `last_name?`, `phone?`, `country_code?` (ISO 3166-1 alpha-2), `avatar_url?`, `role`, `address: UserAddress?`, `version`

## Data model (PostgreSQL)

- `users`: `id` (= Supabase Auth id), `username` (unique), `first_name`, `middle_name`, `last_name`, `phone`, `email` (unique), `avatar_url`, `role`, `country_code` (new), `version` (new), `deleted_at`, `auth_deleted_at` (new)
- `addresses`: `id`, `FK user_id` (unique), `address_line_1`, `address_line_2`, `city`, `zip_code`, `state_province`
- `outbox` (`id`, `type`, `payload jsonb`, `created_at`, `published_at`): the transactional outbox from the contracts README §3. There is no `processed_events`, since Users consumes nothing.
