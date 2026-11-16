# Users

Owns the user profile: username, names, phone, country, avatar, role and the one saved billing address. When an account is deleted, it publishes `user_deleted` so every other service anonymises its copy. PostgreSQL through Prisma. Login, signup, email and password changes go from the frontend straight to Supabase Auth; Users keeps its own copy of the email in sync.

Contracts: `contract.md` (summary), `../docs/contracts/openapi.yaml` and `../docs/contracts/asyncapi.yaml`.

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `POST /users` `{username}` | Called right after Supabase `signUp`. Public via gateway, trusts `X-User-Id` and `X-User-Email`; role is always `customer`. `201`, or `200` with the existing user on a repeat. `409` `username_taken` / `email_taken` / `account_deleted`. Username: 3–32 letters, numbers, `_`, `-`, `.` (the monolith's rules). |
| HTTP in | `GET /users/username-available?username=` | No login. The signup form checks it before `signUp`, so a taken username doesn't leave an orphaned Supabase account. |
| HTTP in | `GET /users/me`, `PATCH /users/me` | Profile with address. `PATCH` changes only the fields sent (`username`, `first_name`, `middle_name`, `last_name`, `phone` ≤ 20, `country_code` ISO alpha-2); `null` clears one. A new username is copied to the Supabase user's `display_name`, best effort. `404` for a deleted or missing user. |
| HTTP in | `PUT /users/me/address`, `DELETE /users/me/address` | Creates or replaces the one saved billing address, or forgets it (`204`, also when there was none). |
| HTTP in | `PUT /users/me/avatar` | Raw `image/jpeg` or `image/png` body, at most 5 MB (`413`). The file's bytes must match the content type (`415`). Stored in Supabase Storage bucket `avatars` as `{user_id}.jpg` / `.png`, replacing the other one; `avatar_url` gets `?v={version}` so caches pick up the new picture. |
| HTTP in | `DELETE /users/me` | Soft delete, see below. `204`, also when repeated. |
| HTTP in | `GET /internal/users/{user_id}` | For Auth only: service JWT with `iss` auth, `aud` users, at most 60 s lifetime, signed with `INTERNAL_JWT_SECRET`. `{user_id, role, deleted}`. Auth's `/verify` turns `role` into the gateway's `X-User-Role` and rejects deleted users. |
| HTTP in | `POST /webhooks/supabase/email-confirmed` | Supabase database webhook (UPDATE on `auth.users`), authenticated by the `x-supabasewebhook-secret` header (`401` otherwise, compared in constant time). Copies a changed `record.email`; any other update is `200` with nothing to do. `404` for an unknown user, `409` if another user has the email. |
| HTTP in | `GET /health` | `200` when RabbitMQ and PostgreSQL are both up. |
| Publishes | `user_deleted` on `user.events` | Through the outbox. Consumed by Orders, Catalog, Messaging, Editorial and Auctions. |
| Consumes | nothing | So there is no `processed_events` inbox. |

**Versions.** Every change to a user (profile, address, avatar, email, deletion) adds 1 to `users.version`. `user_deleted` carries the version, so consumers can ignore stale events.

**Deleting an account.** In one transaction, with the user row locked, Users:
- anonymises the row: username `deleted_{id}`, email `deleted_{id}@deleted.invalid`, and names, phone, country and avatar cleared (the id and role stay);
- deletes the address;
- sets `deleted_at` and bumps the version;
- writes `user_deleted` to `outbox`.

A second delete, also a concurrent one, sees `deleted_at` and writes nothing. The outbox relay publishes the event every second with publisher confirms, at least once.

The Supabase account and the avatar file are removed afterwards, never inside the transaction, so a failing Supabase call can't leave a half-deleted user. The monolith's `nukeUserDependencies` did both inside its transaction. Every 5 seconds the account purger takes deleted users whose `auth_deleted_at` is still empty. For each one it deletes the Supabase user (already gone counts as done), removes `{id}.jpg` and `{id}.png`, and sets `auth_deleted_at`. A failure is retried on the next run. Until then the user can still sign in to Supabase, but Auth's `/verify` rejects them, because `GET /internal/users/{id}` says `deleted`.

Favorites, order addresses and messages are no longer deleted here: Catalog, Orders and Messaging do that on `user_deleted`.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3005` | |
| `DATABASE_URL` | `postgresql://users:users@localhost:5435/users` | compose `users-db` |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | |
| `INTERNAL_JWT_SECRET` | random 32+ characters | Shared with Auth |
| `SUPABASE_WEBHOOK_SECRET` | random 32+ characters | Must match the header configured on the Supabase webhook |
| `IDENTITY_PROVIDER` | `supabase` | `fake` runs without a Supabase project: nothing in Supabase is touched and avatars get a made-up URL (CI security scan, local runs) |
| `SUPABASE_URL` | `https://xyz.supabase.co` | Required with `supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | | Required with `supabase`. Deletes Supabase users and writes to the avatars bucket; never give it to the frontend |
| `AVATAR_BUCKET` | `avatars` | Public bucket, as in the monolith |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
docker compose up -d users-db rabbitmq   # from microservices/
npm run db:deploy    # apply migrations to DATABASE_URL
npm run dev          # tsx watch
npm test             # Vitest; integration tests start Postgres and RabbitMQ via testcontainers (Node 24)
```

## Database

Schema: `prisma/schema.prisma`; the Prisma client is generated into `src/generated/` (gitignored) by `npm run build` / `npm run typecheck`, or `npx prisma generate`.

- `npm run db:migrate -- --name <change>` creates a new migration from schema changes (needs a running database).
- Check constraints are not expressible in Prisma, so they are added by hand to the migration SQL (`users_role_check`, `users_country_code_check`).
- The container runs `prisma migrate deploy` on start.

Changes from the monolith's tables:
- `country_id` became `country_code`, because there is no countries table.
- `users.address_id` is gone: `addresses.user_id` is unique, and that one link is enough.
- `version` and `auth_deleted_at` are new.

Admins are still set by hand in the database (`role = 'admin'`).
