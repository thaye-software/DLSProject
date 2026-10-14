# Contracts: Messaging (draft)

**Status:** Draft for team approval. Based on Architecture v3. Exact endpoints and payloads must be checked against the old monolith and existing contracts.

## Event envelope (all RabbitMQ messages)

Messaging uses the shared CloudEvents 1.0 envelope defined in `docs/contracts/asyncapi.yaml`.

```json
{
  "specversion": "1.0",
  "id": "uuid",
  "source": "users",
  "type": "user_deleted",
  "time": "2026-10-15T10:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "user_id": "uuid",
    "deleted_at": "2026-10-15T10:00:00Z"
  }
}
```

The exact `source`, `type`, and `data` fields must match the shared AsyncAPI schema.

Consumers dedupe on CloudEvents `id` (RabbitMQ can deliver messages more than once).

## Messaging

### Consumes

| Event | From | `data` |
|---|---|---|
| `user_deleted` | Users | `user_id`, `deleted_at` (proposed fields) |

On `user_deleted`, Messaging handles the deleted user's conversations and messages according to the agreed deletion policy.

RabbitMQ configuration:

- Exchange: `user.events`
- Routing key: `user_deleted`
- Queue: `messaging.user.events`
- Dead-letter queue: `messaging.user.events.dlq`

Messages are processed idempotently using the MongoDB inbox.

### Publishes

Nothing to RabbitMQ.

New chat messages are broadcast through Supabase Realtime.

### HTTP (via gateway)

Proposed endpoints:

- `POST /conversations` body `{product_id}`. Creates or retrieves a conversation between a buyer and the product's seller.
- `GET /conversations` returns the authenticated user's conversations.
- `GET /conversations/{id}/messages?before=&limit=50` returns paginated message history.
- `POST /conversations/{id}/messages` body `{content}`. Sends a message to another participant.

Example message response:

```json
{
  "message_id": "uuid",
  "conversation_id": "uuid",
  "sender_user_id": "uuid",
  "content": "Is this watch still available?",
  "created_at": "2026-10-15T10:00:00Z"
}
```

Example message history response:

```json
{
  "items": [
    {
      "message_id": "uuid",
      "conversation_id": "uuid",
      "sender_user_id": "uuid",
      "content": "Is this watch still available?",
      "created_at": "2026-10-15T10:00:00Z"
    }
  ],
  "next_cursor": null
}
```

The API Gateway verifies the Supabase JWT and forwards the authenticated user identity.

Only conversation participants can retrieve messages or send new ones. The sender ID comes from the authenticated context, never from the request body.

HTTP errors follow RFC 9457 `application/problem+json`.

### Outbound HTTP

Catalog `GET /products/{id}` is the specified integration point.

Messaging needs product information to identify the seller and associate conversations with products.

Proposed required response fields:

`{id, seller_user_id, name, ...}`

**Note:** Confirm `seller_user_id` in the Catalog contract. Architecture v3 also requires service-to-service calls to use `/internal/*` with a service JWT; the exact internal Catalog route must be agreed.

### Supabase Realtime

Messaging uses Supabase Realtime to broadcast messages to connected users.

Proposed channel: `conversation:{conversation_id}`

Event: `message_created`

```json
{
  "message_id": "uuid",
  "conversation_id": "uuid",
  "sender_user_id": "uuid",
  "content": "Is this watch still available?",
  "created_at": "2026-10-15T10:00:00Z"
}
```

Message flow:

1. Frontend sends a message through API Gateway.
2. Messaging verifies the sender belongs to the conversation.
3. Message is persisted in MongoDB.
4. Messaging broadcasts `message_created` through Supabase Realtime.
5. Connected participants receive the update over WebSocket.

MongoDB is the source of truth. Supabase Realtime handles live delivery.

Realtime channel access must be restricted to conversation participants. Missed messages can be retrieved through HTTP.

### MongoDB

Proposed collections:

**Conversations**

`conversation_id`, `product_id`, `buyer_user_id`, `seller_user_id`, `created_at`, `updated_at`

**Messages**

`message_id`, `conversation_id`, `sender_user_id`, `content`, `created_at`

**Inbox**

Processed CloudEvents IDs for idempotent event handling.

Index messages by `conversation_id` and `created_at` for efficient message history retrieval.

## Open points to agree with other teams

1. **Existing functionality.** Confirm how conversations and chat work in the old monolith. Only existing functionality should be migrated.

2. **Catalog integration.** Confirm that Catalog exposes the seller's user ID and agree on the internal HTTP route.

3. **User deletion.** Should messages be permanently deleted, anonymized, or retained when a user is deleted?

4. **Conversation creation.** Can a buyer open multiple conversations about the same product? Can sellers initiate conversations?

5. **Product availability.** Should conversations remain active after a product is sold or deleted?

6. **Realtime authorization.** How are Supabase Realtime subscriptions restricted to authorized participants?

7. **Delivery failures.** What happens when a message is stored in MongoDB but the Supabase broadcast fails? Define retry and duplicate-handling behavior.

8. **Existing contracts.** Confirm exact endpoint names, payloads, and event schemas against `docs/contracts/openapi.yaml` and `asyncapi.yaml`.

All agreed contract changes must be made in `microservices/docs/contracts/` before implementation.
