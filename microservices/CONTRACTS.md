# Contracts: Orders and Search (from the team's Event contracts sheet, Architecture v3)

15 events on 5 RabbitMQ topic exchanges. Notation: `?` may be null, `[]` list, `a|b` allowed values, `pi_…` / `re_…` Stripe ids. Money is `{amount_minor: int, currency: ISO 4217}`.

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

## Orders

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

## Search

### Consumes from `catalog.events`

| Event | Subject | `data` | Search does |
|---|---|---|---|
| `product_created` | `product.product_id` | `product: ProductSnapshot`, `changed_by` | insert listing |
| `product_updated` | `product.product_id` | `product: ProductSnapshot`, `changed_by`, `changed_fields: string[]` | replace listing |
| `product_deleted` | `product_id` | `product_id`, `version`, `deleted_by`, `deleted_at` | remove listing |
| `product_availability_changed` | `product_id` | `product_id`, `version`, `availability`, `previous_availability`, `stock`, `reason` (`order_reserved`\|`order_released`\|`order_confirmed`\|`admin_update`), `order_id?`, `changed_at` | show available / reserved / sold |
| `brand_updated` | `brand.brand_id` | `brand: Brand`, `version`, `changed_by`, `changed_at` | update brand on its listings |

Snapshots are full, so handlers are idempotent upserts. Use `version` to ignore stale or out-of-order events.

### Types

- `ProductSnapshot`: `product_id`, `version`, `product_type`, `name`, `description`, `price: Money`, `stock`, `visible: bool`, `availability`, `watch: WatchDetails?`, `images: ProductImage[]`, `created_at`, `updated_at`
- `WatchDetails`: `watch_id`, `brand: Brand`, `model`, `slug`, `reference`, `year`, `condition`, `size_mm?`, `movement?`, `glass_type?`, `limited: bool`, `box: bool`, `papers: bool`, `bracelet_type?`, `bracelet_color?`, `dial_color?`
- `Brand`: `brand_id`, `name`, `slug`
- `ProductImage`: `image_id`, `url`, `is_thumbnail`
- `Availability`: `available | reserved | sold | hidden`

### Publishes

Nothing.

### HTTP (via gateway; proposed, not on the sheet)

`GET /search?q=&type=&brand=&minPrice=&maxPrice=&availability=&page=1&pageSize=20`, returning `{items, page, pageSize, total}` built from the Mongo read model. Redis caches results by query string, invalidated on any `catalog.events` message (TTL as a safety net).

## Open points

1. **Payment → Orders HTTP call:** what does Payment need (amount and status before creating the PaymentIntent?)? Define the endpoint.
2. **Reservation TTL:** how long does a `RESERVED` order live before `order_expired`?
3. **Auctions with `no_bids`:** `winner_user_id` is null, so Orders must ignore those events.
4. **Auction orders:** the items and address come from where? The event has no address, so does the winner still have to supply it before paying?
5. **Who triggers `PROCESSING`, `SHIPPED`, `DELIVERED`, `RETURNED`:** assumed admin through `PATCH /orders/{id}/status`, each publishing `order_status_changed`.
6. **Search needs brand names from `brand_updated`:** products carry the brand inside `WatchDetails`, so a brand rename means re-denormalising many listings.
