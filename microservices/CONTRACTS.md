# Contracts: Orders and Search (draft)

## Event envelope (all RabbitMQ messages)

```json
{ "eventId": "uuid", "type": "order_placed", "version": 1, "occurredAt": "ISO-8601", "data": { } }
```

Consumers dedupe on `eventId` (RabbitMQ delivers at least once).

## Orders

### Consumes

| Event | From | `data` |
|---|---|---|
| `auction_complete` | Auctions | `auctionId`, `productId`, `winnerUserId`, `finalPriceDkk`, `completedAt` |
| `payment_complete` | Payment | `orderId`, `paymentId`, `amountDkk`, `paidAt` |

### Publishes

| Event | To | `data` |
|---|---|---|
| `order_placed` | Payment, Notif/Email | `orderId`, `userId`, `items[{productId, quantity, unitPriceDkk}]`, `totalPriceDkk`, `auctionId?`, `createdAt` |
| `order_cancelled` | Payment (refund), Notif/Email | `orderId`, `userId`, `reason` (`USER`, `ADMIN`, `PAYMENT_FAILED`, `EXPIRED`), `cancelledAt` |

### State machine

`PENDING` --`payment_complete`--> `PROCESSING` --admin--> `SHIPPED` --admin--> `DELIVERED`
`PENDING` or `PROCESSING` --cancel--> `CANCELLED`. Terminal: `DELIVERED`, `CANCELLED`.
Statuses match the old `orders_status_check`.

### HTTP (via gateway)

- `GET /orders` (own orders, admin: all), `GET /orders/{id}`
- `POST /orders` body `{items[{productId, quantity}], deliveryAddress, billingAddress}`. Price and stock are checked against Catalog `GET /products/{id}` (sync call), never taken from the client.
- `POST /orders/{id}/cancel` body `{reason?}`
- `PATCH /orders/{id}/status` (admin) body `{status: SHIPPED | DELIVERED}`

### Outbound HTTP

Catalog `GET /products/{id}` returns `{id, name, priceDkk, stock}`.

## Search

### Consumes (from Catalog)

All three carry a full snapshot so the handler is an idempotent upsert/delete.

| Event | `data` |
|---|---|
| `product_created` | `productId`, `name`, `productType`, `priceDkk`, `description`, `stock`, `thumbnailUrl`, `createdAt`, `updatedAt` |
| `product_updated` | same as `product_created` |
| `product_deleted` | `productId`, `deletedAt` |

Ignore an event whose `updatedAt` is older than the stored one (out-of-order delivery).

### Publishes

Nothing.

### HTTP (via gateway)

`GET /search?q=&type=&minPrice=&maxPrice=&inStock=&page=1&pageSize=20`

```json
{ "items": [{ "productId": "", "name": "", "productType": "", "priceDkk": 0, "stock": 0, "thumbnailUrl": "" }],
  "page": 1, "pageSize": 20, "total": 0 }
```

Redis caches results by query string, invalidated on any `product_*` event (TTL as a safety net).

## Open points to agree with other teams

1. **`payment_failed` event is missing.** Without it an unpaid order never leaves `PENDING`. Either add it or Orders expires `PENDING` orders itself (the old project had an expired-orders webhook) and emits `order_cancelled` with reason `EXPIRED`.
2. **Stock release on cancel.** Catalog isn't drawn consuming `order_cancelled`. Decide who restores stock.
3. **Gateway route for Search.** The v2 diagram has none.
4. **Auction orders:** one item, quantity 1, price = `finalPriceDkk`. Confirm Auctions sends the winner's `userId` and that Orders doesn't re-check price in Catalog for those.
5. **Addresses.** The old schema stores address ids. Decide whether Orders snapshots the address in the order or references Users.
