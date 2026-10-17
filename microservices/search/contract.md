# Contract: Search

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

## Search (events and HTTP)

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

### HTTP

See `docs/contracts/openapi.yaml`: public `GET /search` (`q`, `brand`, `availability`, `min_price`, `max_price` in øre, `page`, `page_size`), returning `SearchResults` of `ProductListing`. Redis caches results by query string, invalidated on any `catalog.events` message (TTL as a safety net).

## Data model (MongoDB + Redis)

`product_listings` (new), keyed by `REF product_id`: `name`, `slug`, `REF brand_id`, `brand_name`, `brand_slug`, `model`, `reference`, `year`, `size_mm`, `condition`, `limited`, `price_dkk`, `availability`, `thumbnail_url`, `version`, `updated_at`.

## Open points

See `DECISIONS.md` in the repo root.
