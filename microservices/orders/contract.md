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
- `OrderTotals`: `subtotal`, `shipping`, `total`, `total_charged` (all `Money`)
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

- Via gateway: `GET /orders`, `GET /orders/{id}`, `POST /orders`, `POST /orders/{id}/cancel`, `PATCH /orders/{id}/status` (admin). Proposed, not on the sheet.
- Outbound to Catalog: reserve stock. Also ipapi.co geo-IP.
- Inbound from Payment: Payment calls Orders. Endpoint to define.

## Data model (PostgreSQL)

- `orders`: `id`, `REF user_id`, `status varchar`, `shipping_price_dkk`, `sub_total_dkk`, `total_price_dkk`, `FK delivery_address_id`, `FK billing_address_id`, `created_at`, `customer_email` (new)
- `order_items`: `id`, `FK order_id`, `REF product_id`, `quantity`, `product_name` (new), `thumbnail_url` (new)
- `order_addresses`: `id`, `first_name`, `middle_name`, `last_name`, `address_line_1`, `address_line_2`, `city`, `zip_code`, `state_province`, `country`
- `countries` (from Localization): `id`, `name`, `abbreviation`, `vat_rate`. Currencies were dropped from the ERD (DKK only).

### Gaps between the ERD and the events

1. **Order has no unit price.** `order_items` has no price column and `OrderLine` carries none either, so line prices can't be shown after the product price changes. Add a price snapshot, or confirm line prices aren't needed.
2. **No reservation expiry.** `orders` has no `reserved_at` or `expires_at`, which `order_expired` and the `RESERVED` timeout need.
3. **No payment link.** No `payment_intent_id` or refund table, though `payment_*` and `refund_requested` events carry `payment_intent_id` and `refund_request_id`. `refund_requested` needs `paid_after_expiry` handled.
4. **Money mapping.** The ERD is DKK only, so every `Money` is `currency: "DKK"` and `OrderTotals.total_charged` equals `total`. The events still carry a currency field and `total_charged`, so either keep them as constants or drop them from the sheet. Decimal DKK in the tables vs `amount_minor` (øre) in events needs a conversion rule.
5. **Order status** is `varchar`: add a check constraint for the nine `OrderStatus` values.

## Open points

1. **Payment → Orders HTTP call:** what does Payment need (amount and status before creating the PaymentIntent?)? Define the endpoint.
2. **Reservation TTL:** how long does a `RESERVED` order live before `order_expired`?
3. **Auctions with `no_bids`:** `winner_user_id` is null, so Orders must ignore those events.
4. **Auction orders:** the items and address come from where? The event has no address, so does the winner still have to supply it before paying?
5. **Who triggers `PROCESSING`, `SHIPPED`, `DELIVERED`, `RETURNED`:** assumed admin through `PATCH /orders/{id}/status`, each publishing `order_status_changed`.
