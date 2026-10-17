# Open decisions

Things that are proposed or unclear and still need a team decision. When one is decided, update the contracts (`microservices/docs/contracts/*.yaml` first, then the diagrams) and delete it here.

## Orders

### 1. What if a refund fails or is requested twice?
There is no event for a failed refund: if Stripe rejects it (for example the charge is too old), the order says `REFUNDED` but the money hasn't moved, and nobody is told. Add a `refund_failed` event on `payment.events` (Orders then notifies an admin or flags the order), or accept it as a manual case for now.
A second `refund_requested` for the same order must not refund twice. The admin path can no longer do it (a CANCELLED order cannot be set to REFUNDED), but two separate `payment_complete` events for an EXPIRED or CANCELLED order would each request one. Payment uses `refund_request_id` as Stripe's idempotency key, and each request has its own id. Decide whether Orders remembers that a refund is pending or done and skips further requests, or whether Payment checks Stripe for an existing refund first.

### 2. Auction orders: address and payment
`auction_complete` creates a `RESERVED` order for the winner, but carries no address. Does the winner fill in billing and delivery addresses before paying (an order with no address until then)? Does the 30 min expiry apply to auction wins, or a longer window? Is the price `winning_bid` taken as-is, without a Catalog reservation?

### 3. `offer_token` format
`CreateOrderRequest.offer_token` is a signed offer from Messaging (agreed price) that Orders verifies. No contract defines its claims, signing algorithm or key. Needs an agreement with whoever owns Messaging. Until then, Orders answers 422 to any non-null `offer_token`.

### 4. Who is `changed_by` when the system changes an order's status?
`order_status_changed.changed_by` is a required user uuid. When Payment reports a refund for an order that is still active (PENDING to DELIVERED), for example one refunded directly in the Stripe dashboard, Orders sets it REFUNDED but has no user to put there, so today it publishes nothing and Catalog does not put the stock back (Orders logs a warning). Make `changed_by` nullable for system changes, or agree on a fixed "system" id, and Orders will publish the event.

## Search

### 5. Indexes for Search
- Add a text index on `name`, `brand_name` and `reference` for `q`, and an index on `brand_id` for `brand_updated`.
- Add a TTL index on `processed_events.processed_at` (the collection itself is in the ERD).

## Cross-team

### 6. `messaging/contract.md` envelope
It shows `"source": "users"` and leaves out `subject`, `dataversion`, `correlationid` and `causationid`. That doesn't match the CloudEvents envelope in `asyncapi.yaml` (`source: /services/<publisher>`).

### 7. Auctions vs. normal sales
A watch on auction should not be sellable through checkout at the same time. Either Auctions reserves it in Catalog when the auction starts, or Catalog marks it `hidden`. Needs one more contract once decided. (Moved from the contracts README.)

### 8. Auctions database
The architecture diagram says "DB". The monolith keeps `auctions` in PostgreSQL, so PostgreSQL is the no-change choice. (Moved from the contracts README.)
