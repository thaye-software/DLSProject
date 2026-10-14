# Contracts: Messaging (draft)

## Event envelope (RabbitMQ)

Uses the shared event envelope defined by the other services.

```json
{
  "eventId": "uuid",
  "type": "user_deleted",
  "version": 1,
  "occurredAt": "ISO-8601",
  "data": {}
}
```

Consumers dedupe on `eventId` (RabbitMQ delivers at least once).

## Messaging

### Consumes

| Event | From | `data` |
|---|---|---|
| `user_deleted` | Users | `userId`, `deletedAt` |

On `user_deleted`, Messaging processes the deleted user's conversations and messages according to the agreed data-retention policy. Whether messages are deleted or anonymized must be decided.

### Publishes

Nothing to RabbitMQ.

Messaging broadcasts new messages through Supabase Realtime instead.

### HTTP (via gateway)

- `POST /conversations` body `{productId}`. Creates a conversation between the authenticated buyer and the product's seller.
- `GET /conversations` returns all conversations belonging to the authenticated user.
- `GET /conversations/{id}` returns conversation details.
- `GET /conversations/{id}/messages?before=&limit=50` returns paginated message history.
- `POST /conversations/{id}/messages` body `{content, clientMessageId?}`. Sends a message to the conversation.

Example message response:

```json
{
  "messageId": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "content": "Is this watch still available?",
  "createdAt": "ISO-8601"
}
```

### Authorization and validation

- API Gateway verifies the user's JWT.
- Messaging obtains the authenticated user's identity from trusted gateway authentication context, never from a client-supplied `senderId`.
- Only conversation participants can read and send messages.
- Users cannot start conversations with themselves.
- Product existence and seller ownership are verified through Catalog.
- Duplicate conversations for the same buyer, seller and product should be prevented.
- `clientMessageId` can be used to prevent duplicate messages on retries.
- Invalid requests return `400`, unauthorized requests `401`, and forbidden access `403`.

### Outbound HTTP

Catalog `GET /products/{id}` returns `{id, name, priceDkk, stock, sellerUserId, status}`.

Messaging uses this to validate the product and identify the seller when creating a conversation.

**Note:** `sellerUserId` and `status` are proposed additions to the existing Catalog contract and require agreement with the Catalog team.

### Supabase Realtime

Messaging uses Supabase Realtime to broadcast messages to connected clients.

Channel: `conversation:{conversationId}`

Event: `message_created`

```json
{
  "messageId": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "content": "Is this watch still available?",
  "createdAt": "ISO-8601"
}
```

Flow:

1. Client sends a message through HTTP via API Gateway.
2. Messaging validates that the sender belongs to the conversation.
3. Message is stored in MongoDB.
4. Messaging broadcasts `message_created` through Supabase Realtime.
5. Connected conversation participants receive the message through WebSocket.

MongoDB is the source of truth. Supabase Realtime handles live delivery, not persistent message storage.

Realtime channel access must be restricted to conversation participants. Missed messages are retrieved through HTTP.

### MongoDB

Two proposed collections:

**Conversations**

`conversationId`, `productId`, `buyerUserId`, `sellerUserId`, `createdAt`, `updatedAt`

**Messages**

`messageId`, `conversationId`, `senderId`, `content`, `createdAt`, `clientMessageId?`

Index messages by `conversationId` and `createdAt` for efficient message-history retrieval.

## Open points to agree with other teams

1. **Catalog seller information.** Messaging needs `sellerUserId` from Catalog to identify the recipient. The existing Catalog contract does not include this field.

2. **User deletion.** When receiving `user_deleted`, should Messaging permanently delete messages, anonymize the user, or retain conversation history for the other participant?

3. **Product availability.** Should users still be able to send messages when a product is sold, deleted, or an auction has ended? Messaging currently does not consume Catalog events.

4. **Realtime authorization.** Confirm how Supabase Realtime channels authenticate users and restrict subscriptions to conversation participants.

5. **Conversation rules.** Can users have multiple conversations about the same product? Can sellers initiate conversations, or only buyers?

6. **Message functionality.** Decide whether messages can be edited, deleted, marked as read, or include images. These features would require additional endpoints and fields.

7. **Realtime delivery failures.** If MongoDB saves a message but broadcasting fails, the message remains stored. Decide whether to retry broadcasting or rely on clients fetching missed messages.

8. **API contract format.** The diagram specifies HTTP REST. Use OpenAPI for the HTTP contract unless the team agrees to switch to gRPC.
