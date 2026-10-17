# Open decisions

Things that are proposed or unclear and still need a team decision. When one is decided, update the contracts (`microservices/docs/contracts/*.yaml` first, then the diagrams) and delete it here.

## Orders

### 1. Should an admin setting `REFUNDED` also refund through Stripe?
`PATCH /orders/{order_id}/status` with `REFUNDED` currently publishes only `order_status_changed`, as the monolith did. To actually refund the money, Orders would also publish `refund_requested` (reason `admin`, which the enum already has).
**Recommendation:** publish `refund_requested`, and set `REFUNDED` only when `payment_refunded` arrives. Otherwise the status says refunded while the money isn't.

### 2. Outbox, inbox and status check for the Orders ERD
Proposed for the Orders ERD:

| Table | Columns | Why |
|---|---|---|
| `outbox` (new) | `id uuid PK`, `type varchar`, `payload jsonb`, `created_at timestamp`, `published_at timestamp NULL` | Transactional outbox (contracts README §3). |
| `processed_events` (new) | `event_id uuid PK`, `type varchar`, `processed_at timestamp` | Idempotent inbox (contracts README §3). |

Plus a check constraint on `orders.status` for the nine `OrderStatus` values.

### 3. When can a customer cancel?
`POST /orders/{order_id}/cancel` allows `RESERVED` and `PENDING` (paid, not yet processing). A cancel while `PENDING` triggers a refund. Confirm that window, or limit it to `RESERVED` (unpaid) only.

### 4. Auction orders: address and payment
`auction_complete` creates a `RESERVED` order for the winner, but carries no address. Does the winner fill in billing and delivery addresses before paying (an order with no address until then)? Does the 30 min expiry apply to auction wins, or a longer window? Is the price `winning_bid` taken as-is, without a Catalog reservation?

### 5. What Orders anonymises on `user_deleted`
The contracts say every service "anonymises what it holds and keeps the id". For Orders that is presumably `customer_email` and the names in `order_addresses`. Decide whether the street address stays (bookkeeping) or is cleared.

### 6. `offer_token` format
`CreateOrderRequest.offer_token` is a signed offer from Messaging (agreed price) that Orders verifies. No contract defines its claims, signing algorithm or key. Needs an agreement with whoever owns Messaging.

## Search

### 7. Indexes and inbox for `product_listings`
- Add a text index on `name`, `brand_name` and `reference` for `q`, and an index on `brand_id` for `brand_updated`.
- Add a `processed_events` collection: `_id` = event id, `processed_at` with a TTL index.

## Cross-team

### 8. Outbox and inbox tables in the other services' ERDs
The contracts README requires an `outbox` for every service that publishes and has a database (Users, Catalog, Auctions, Orders), and a `processed_events` inbox for every consumer with a database (Orders, Catalog, Search, Messaging, Editorial, Auctions). Only Orders and Search are proposed above.

### 9. `messaging/contract.md` envelope
It shows `"source": "users"` and leaves out `subject`, `dataversion`, `correlationid` and `causationid`. That doesn't match the CloudEvents envelope in `asyncapi.yaml` (`source: /services/<publisher>`).

### 10. Auctions vs. normal sales
A watch on auction should not be sellable through checkout at the same time. Either Auctions reserves it in Catalog when the auction starts, or Catalog marks it `hidden`. Needs one more contract once decided. (Moved from the contracts README.)

### 11. Auctions database
The architecture diagram says "DB". The monolith keeps `auctions` in PostgreSQL, so PostgreSQL is the no-change choice. (Moved from the contracts README.)
