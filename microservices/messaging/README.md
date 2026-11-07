# Messaging

Website chat: a customer asks the shop about a product. MongoDB is the source of truth. Live updates go out through Supabase Realtime (Broadcast REST API). Messaging never hosts a WebSocket of its own.

Contracts: `contract.md` (summary), `../docs/contracts/openapi.yaml` (HTTP) and `../docs/contracts/asyncapi.yaml` (`user_deleted`).

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `POST /conversations` | Via gateway, customer JWT (`X-User-Id`). Create or return the thread for `{product_id}`. Calls Catalog. `201` created, `200` existing, `403` admin, `404` unknown product, `502` Catalog down. |
| HTTP in | `GET /conversations` | Customer: own. `X-User-Role: admin`: all. Newest first, with last message and `unread_count`. |
| HTTP in | `GET /conversations/{id}/messages` | `before` cursor, `limit` 1–100 default 50. Participant or admin. |
| HTTP in | `POST /conversations/{id}/messages` | `{content}` max 2000 characters. `Idempotency-Key` (UUID) required: a repeat returns the first message and does not broadcast again. Persist, then Realtime `message_created`. A Realtime failure still returns `201`. |
| HTTP in | `POST /conversations/{id}/read` | Clears this viewer's unread count. `204`. |
| HTTP in | `GET /health` | `200` when RabbitMQ and MongoDB are up. Catalog and Realtime are not checked. |
| RabbitMQ in | `user_deleted` on `user.events` | Queue `messaging.user.events`, dead letters to `messaging.user.events.dlq`. Sets `customer_display_name` to `"Deleted User"` and keeps ids. |
| Publishes | nothing on RabbitMQ | Broadcasts `message_created` on Realtime channel `conversation:{conversation_id}`. |
| HTTP out | Catalog `GET /products/{product_id}` | Snapshot `name` and `thumbnail_url` when a conversation is created. |

The frontend subscribes to Supabase Realtime itself:

```ts
supabase.channel(`conversation:${id}`).on("broadcast", { event: "message_created" }, handler).subscribe();
```

Without `SUPABASE_URL` / `SUPABASE_SECRET_KEY`, broadcasts are skipped and history still works over HTTP.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3004` | |
| `MONGODB_URL` | `mongodb://localhost:27019/messaging` | compose `messaging-db` |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | |
| `CATALOG_URL` | `http://localhost:3002` | |
| `SUPABASE_URL` | `http://localhost:54321` | leave empty to skip Realtime |
| `SUPABASE_SECRET_KEY` | service role key | leave empty to skip Realtime |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
docker compose up -d messaging-db rabbitmq   # from microservices/
npm run dev          # tsx watch
npm test             # Vitest; integration tests start MongoDB and RabbitMQ via testcontainers
```
