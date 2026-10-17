# Contract: Orders

15 events on 5 RabbitMQ topic exchanges, from the team's Event contracts sheet (Architecture v3). Authoritative machine-readable versions: `docs/contracts/asyncapi.yaml` and `docs/contracts/openapi.yaml`. Notation: `?` may be null, `[]` list, `a|b` allowed values, `pi_…` / `re_…` Stripe ids. Money is `{amount_minor: int, currency: ISO 4217}`.

## Envelope (CloudEvents, every message)

| Field | Meaning |
|---|---|
| `specversion` | `"1.0"` |
| `id` | uuid, idempotency key (dedupe on it) |
| `source` | `/services/<publisher>` |
| `type` | event name, also the routing key |
| `time` | timestamp |
| `datacontenttype` | `"application/json"` |
| `subject` | id of the aggregate (shown per event below) |
| `dataversion` | schema version of `data` |
| `correlationid` | flow id (the order id) |
| `causationid` | uuid?, the triggering event |
| `data` | the card for the event |

Queue per consumer: `<consumer>.<exchange>`, with a dead-letter queue `.dlq`.

## Orders (events and HTTP)

### Consumes

| Event | From | Subject | `data` | Orders does |
|---|---|---|---|---|
| `auction_complete` | Auctions | `auction_id` | `auction_id`, `product_id`, `watch_id`, `outcome` (`sold`\|`no_bids`), `winner_user_id?`, `winner_email?`, `winning_bid: Money?`, `starting_price: Money`, `ended_at` | create a `RESERVED` order for the winner |
| `payment_complete` | Payment | `order_id` | `payment_intent_id`, `order_id`, `user_id`, `amount: Money`, `paid_at` | `RESERVED` → `PENDING`, or request a refund if already expired |
| `payment_failed` | Payment | `order_id` | `payment_intent_id`, `order_id`, `user_id`, `amount: Money`, `failure_code?`, `failure_message?`, `failed_at` | record the attempt, order stays `RESERVED` |
| `payment_refunded` | Payment | `order_id` | `payment_intent_id`, `order_id`, `user_id`, `refund_request_id?`, `amount: Money`, `stripe_refund_id`, `refunded_at` | set order `REFUNDED` |
| `user_deleted` | Users | `user_id` | `user_id`, `version`, `deleted_at` | anonymise personal data |

### Publishes on `order.events`

| Event | Subject | `data` | Consumers |
|---|---|---|---|
| `order_confirmed` | `order_id` | `order_id`, `user_id`, `customer_email`, `status` (`"PENDING"`), `items: OrderLine[]`, `totals: OrderTotals`, `billing_address: Address`, `delivery_address: Address`, `confirmed_at` | Notif (confirmation email), Catalog (mark products sold) |
| `order_cancelled` | `order_id` | `order_id`, `user_id`, `previous_status`, `reason` (`customer_request`\|`admin`), `items: ItemQuantity[]`, `was_paid: bool`, `cancelled_at` | Catalog (release stock), Payment (cancel open PaymentIntent) |
| `order_expired` | `order_id` | `order_id`, `user_id`, `items: ItemQuantity[]`, `reserved_at`, `expired_at` | Catalog (release stock), Payment (cancel PaymentIntent) |
| `order_status_changed` | `order_id` | `order_id`, `user_id`, `previous_status`, `status`, `items: ItemQuantity[]`, `changed_by`, `changed_at` | Catalog (put stock back or take it again) |
| `refund_requested` | `order_id` | `refund_request_id`, `order_id`, `user_id`, `amount: Money`, `reason` (`paid_after_expiry`\|`cancelled_after_payment`\|`admin`), `requested_at` | Payment (refund through Stripe) |

### Types

- `OrderStatus`: `RESERVED | EXPIRED | PENDING | PROCESSING | SHIPPED | DELIVERED | CANCELLED | RETURNED | REFUNDED`
- `OrderLine`: `product_id`, `product_name`, `quantity`, `thumbnail_url?`
- `ItemQuantity`: `product_id`, `quantity`
- `OrderTotals`: `subtotal`, `shipping`, `total` (all `Money`)
- `Address`: `first_name`, `middle_name?`, `last_name`, `address_line_1`, `address_line_2?`, `city`, `zip_code`, `state_province?`, `country_code` (ISO 3166-1)

### State machine (inferred from the events; the sheet gives the statuses, not the transitions)

```
RESERVED --payment_complete--> PENDING --admin--> PROCESSING --> SHIPPED --> DELIVERED
RESERVED --timeout--> EXPIRED (order_expired)
EXPIRED + payment_complete --> refund_requested(paid_after_expiry)
PENDING/PROCESSING --cancel--> CANCELLED (+ refund_requested if was_paid) --payment_refunded--> REFUNDED
DELIVERED --> RETURNED
```

### HTTP

See `docs/contracts/openapi.yaml`: `POST /orders`, `GET /orders`, `GET /orders/{order_id}`, `POST /orders/{order_id}/cancel`, `PATCH /orders/{order_id}/status` (admin), and internal `GET /internal/orders/{order_id}/payment-details` (Payment). Outbound: Catalog `POST /internal/reservations` and `DELETE /internal/reservations/{order_id}`; ipapi.co geo-IP.

## Data model (PostgreSQL)

- `orders`: `id`, `REF user_id`, `status varchar`, `shipping_price_dkk`, `sub_total_dkk`, `total_price_dkk`, `FK delivery_address_id`, `FK billing_address_id`, `created_at`, `customer_email` (new), `expires_at` (new), `idempotency_key` (new)
- `order_items`: `id`, `FK order_id`, `REF product_id`, `quantity`, `product_name` (new), `thumbnail_url` (new), `unit_price_dkk` (new)
- `order_addresses`: `id`, `first_name`, `middle_name`, `last_name`, `address_line_1`, `address_line_2`, `city`, `zip_code`, `state_province`, `country`
- No `countries` table: countries are ISO 3166-1 alpha-2 codes (`order_addresses.country`, `users.country_code`). VAT is not calculated, so prices are final.

Proposed outbox and inbox tables and other open questions: see `DECISIONS.md` in the repo root.
