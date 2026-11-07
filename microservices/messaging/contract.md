# Contract: Messaging

Website chat: a customer asks the shop about a product. Authoritative HTTP: `docs/contracts/openapi.yaml`. `user_deleted`: `docs/contracts/asyncapi.yaml`.

Architecture v3: MongoDB is the source of truth; Messaging broadcasts live updates on **Supabase Realtime**. The frontend keeps a WebSocket to Realtime, not to this service. Chat is never published on RabbitMQ.

## Envelope (CloudEvents, every RabbitMQ message)

| Field | Meaning |
|---|---|
| `specversion` | `"1.0"` |
| `id` | uuid, idempotency key (dedupe on it) |
| `source` | `/services/<publisher>` |
| `type` | event name, also the routing key |
| `time` | timestamp |
| `datacontenttype` | `"application/json"` |
| `subject` | id of the aggregate |
| `dataversion` | schema version of `data` |
| `correlationid` | flow id |
| `causationid` | uuid?, the triggering event |
| `data` | the card for the event |

Queue: `<consumer>.<exchange>`, with a dead-letter queue `.dlq`.

## Messaging

### Consumes from `user.events`

| Event | Subject | `data` | Messaging does |
|---|---|---|---|
| `user_deleted` | `user_id` | `user_id`, `version`, `deleted_at` | set `customer_display_name` to `"Deleted User"`; keep conversations, messages and ids |

Inbox: CloudEvent `id` in `processed_events`. Duplicate deliveries are skipped.

### Publishes

Nothing to RabbitMQ. New chat messages are broadcast through Supabase Realtime.

### HTTP (via gateway)

See `docs/contracts/openapi.yaml`. Identity from `X-User-Id` and `X-User-Role` (`admin` or customer). Sender is never taken from the body.

| Call | Who |
|---|---|
| `POST /conversations` `{product_id}` | Customer. Create or return the thread for that product. Catalog `GET /products/{product_id}`; snapshot name and thumbnail. |
| `GET /conversations` | Customer: own. Admin: all. Newest `updated_at` first. |
| `GET /conversations/{id}/messages?before=&limit=50` | Participant or admin. Chronological page; `next_cursor` loads older. |
| `POST /conversations/{id}/messages` `{content}` | Participant or admin. `Idempotency-Key` required (UUID). Persist, then Realtime `message_created`. A repeat returns the first message and does not broadcast again. Max 2000 characters. |
| `POST /conversations/{id}/read` | Participant or admin. Clears this viewer's unread count. |

One conversation per `(customer_user_id, product_id)`. Admins do not open conversations; they reply on existing ones. Errors: RFC 9457 `application/problem+json`.

### Outbound HTTP

Catalog `GET /products/{product_id}` (`ProductSummary`: `product_id`, `name`, `thumbnail_url`, …). No `seller_user_id`: this is a single shop.

### Supabase Realtime

Channel: `conversation:{conversation_id}`

Event: `message_created`

Payload: `ChatMessage` (`message_id`, `conversation_id`, `sender_user_id`, `content`, `created_at`).

Flow: frontend POST via gateway → Messaging stores in MongoDB → Broadcast HTTP API → connected clients. A Realtime failure does not fail the POST; missed messages come from HTTP history. The server uses the Broadcast REST API so it does not hold a WebSocket of its own.

Frontend subscribe (private channel is a later hardening):

```ts
supabase.channel(`conversation:${conversationId}`).on("broadcast", { event: "message_created" }, handler).subscribe();
```

## Data model (MongoDB)

`conversations`, `_id` = `conversation_id`: `customer_user_id`, `customer_display_name`, `product_id`, `product_name`, `thumbnail_url`, `last_message`, `customer_unread_count`, `shop_unread_count`, `customer_last_read_at`, `shop_last_read_at`, `created_at`, `updated_at`. Unique `(customer_user_id, product_id)`.

`messages`, `_id` = `message_id` (UUIDv5 of conversation, sender and Idempotency-Key): `conversation_id`, `sender_user_id`, `content`, `idempotency_key`, `created_at`. Unique `(conversation_id, sender_user_id, idempotency_key)`. Index `(conversation_id, created_at)`.

`processed_events` (`_id` = event id, `type`, `processed_at`, 14 day TTL): inbox. Messaging publishes nothing, so it has no outbox.
