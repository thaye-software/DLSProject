# Search

The product search index: a MongoDB read model built from `catalog.events`, with a Redis cache in front of it. Search never calls Catalog; every event carries the full state it needs.

Contracts: `contract.md` (summary), `../docs/contracts/openapi.yaml` (`GET /search`) and `../docs/contracts/asyncapi.yaml`. Open questions: `../../DECISIONS.md`.

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `GET /search` | Public via gateway. `q` (words, max 200 characters), `brand` (slug), `availability` (repeatable, default `available`, `hidden` is not allowed), `min_price` / `max_price` (øre, inclusive), `page`, `page_size` (1–100, default 20). `422` for an invalid query. |
| HTTP in | `GET /health` | `200` when RabbitMQ and MongoDB are up. Redis is not checked: without it searches still work, uncached. |
| RabbitMQ in | `product_created`, `product_updated`, `product_deleted`, `product_availability_changed`, `brand_updated` on `catalog.events` | Queue `search.catalog.events`, dead letters to `search.catalog.events.dlq`. A body that doesn't match its event type is dead-lettered at once, a handler that throws after 5 retries. |
| Publishes | nothing | |

## How a search matches

- Every word of `q` must be in the name, the brand name or the reference, in any order, case-insensitive, and as a part of a word: `1266` finds `126610LN`, like the monolith's search. Regex characters in `q` are plain text. (MongoDB's `$text` index only matches whole words, so it isn't used.)
- Best match first: the reference is exactly `q`, then a name that starts with `q`, then anything else; ties go to the most recently updated. Without `q`: most recently updated first.
- Hidden products and deleted products are never returned: a hidden product isn't indexed at all.

## How events are applied

- **Versions.** Catalog's `version` is one counter per product, carried by snapshots and availability events alike. An event is applied only if its version is newer than the stored one; otherwise it is logged as ignored. Writes are conditional in MongoDB itself (`replaceOne` filtered on `version < v`), so concurrent consumers can't overwrite a newer listing.
- **Hidden products** (a snapshot or an availability change with `hidden`) are stored as a tombstone too, not as a listing. A later snapshot with a newer version replaces the tombstone and the product is searchable again; an availability change to `available` alone can't, because the tombstone has no data, so it is logged as ignored until the next `product_created` / `product_updated`.
- **Deletes** leave a tombstone (`{ _id, version, deleted: true }`), so an older `product_updated` arriving late can't bring the product back.
- **`product_availability_changed` for a product with no listing** is acknowledged and logged, not retried: Catalog sends one for every reservation, including for products Search was never told about.
- **Brands** have their own version. The `brands` collection keeps the newest name and slug, so a product snapshot built before a rename doesn't undo it, and `brand_updated` renames the brand on all its listings.
- **One event at a time.** The consumer runs with `prefetch: 1`. The version-guarded writes are safe against a duplicate-key race between two events for a product that isn't stored yet (the loser re-checks the stored version and goes again, tested 25 rounds a case), but two things still need the events in order: an availability change running beside its own `product_created` would come back "unknown" and be dropped, and a snapshot read of `brands` could miss a rename landing in between. Serial handling closes both. Catalog's event volume is tiny, so it costs nothing; run **one instance** of Search.
- **Inbox.** The CloudEvent id is checked first and recorded last in `processed_events` (14 day TTL). MongoDB runs standalone, so there is no transaction; every change is idempotent through the version rules, so a crash in between only repeats a no-op.

## The cache

Results are cached in Redis for 60 seconds under `search:<generation>:<query>`. Every event that changes the index increments `search:generation`, which makes all earlier keys unreachable at once: no `KEYS` or `SCAN`. The generation is read before MongoDB is queried, so a result computed while an event lands can't be served as fresh. Any Redis failure falls back to MongoDB, and Redis commands fail at once instead of queueing while it is down. Without `REDIS_URL` there is no cache.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3003` | |
| `MONGODB_URL` | `mongodb://localhost:27018/search` | compose `search-db` |
| `REDIS_URL` | `redis://localhost:6380` | compose `search-cache`; leave empty for no cache |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
docker compose up -d search-db search-cache rabbitmq   # from microservices/
npm run dev          # tsx watch
npm test             # Vitest; integration tests start MongoDB, Redis and RabbitMQ via testcontainers
```

**The index starts empty.** Catalog publishes only `product_availability_changed` today, which Search ignores for unknown products, so nothing gets indexed until Catalog also publishes `product_created` (see "Catalog doesn't publish product events yet" in `DECISIONS.md`).
