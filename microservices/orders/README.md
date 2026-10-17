# Orders

Owns orders from reservation to delivery: creates them (reserving stock in Catalog), tracks payment through `payment.events`, expires unpaid ones after 30 minutes and lets admins move them forward. PostgreSQL through Prisma.

Contracts: `contract.md` (summary), `../docs/contracts/openapi.yaml` and `../docs/contracts/asyncapi.yaml`. Open questions: `../../DECISIONS.md`.

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `POST /orders` | Public via gateway, trusts `X-User-Id` and `X-User-Email`. Reserves stock in Catalog and stores a `RESERVED` order that expires in 30 minutes. `Idempotency-Key` is required: a repeat returns the first order (201). `409` with `unavailable_product_ids` when Catalog is out of stock, `502` when Catalog or the database fails (the reservation is released). A non-null `offer_token` is rejected with `422` for now. |
| HTTP in | `GET /orders` | Newest first. A customer gets their own orders, `X-User-Role: admin` gets everyone's. `?status=` (repeatable), `page`, `page_size` (1–100, default 20). |
| HTTP in | `GET /orders/{order_id}` | Owner or admin. `404` for someone else's order, so ids can't be probed. |
| HTTP in | `POST /orders/{order_id}/cancel` | The owner cancels an unpaid (`RESERVED`) order: `CANCELLED` plus `order_cancelled` (reason `customer_request`). Cancelling again returns it unchanged. `409` once paid, `404` for someone else's order. |
| HTTP in | `PATCH /orders/{order_id}/status` | `X-User-Role: admin` only (`403` otherwise). Forward only: `PENDING` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `RETURNED`; `CANCELLED` from `PENDING`–`DELIVERED` (publishes `order_cancelled` and a refund); `REFUNDED` from those or `RETURNED` (publishes `order_status_changed` and a refund); other changes publish `order_status_changed`. Anything else `409`; the same status again is a no-op. |
| HTTP in | `GET /internal/orders/{order_id}/payment-details` | Internal, for Payment only: service JWT with `iss` payment, `aud` orders, at most 60 s lifetime, signed with `INTERNAL_JWT_SECRET`; `401` otherwise. `200` with the amount due only while the order is `RESERVED` and before `expires_at`, `409` otherwise, `404` if unknown. |
| HTTP in | `GET /health` | `200` when RabbitMQ and PostgreSQL are both up. |
| RabbitMQ in | `payment_complete`, `payment_failed`, `payment_refunded` on `payment.events` | Queue `orders.payment.events`, dead letters to `orders.payment.events.dlq`. `payment_complete`: `RESERVED` → `PENDING` plus `order_confirmed` (also just after `expires_at`, as long as the sweeper hasn't expired it); for an `EXPIRED` or `CANCELLED` order a `refund_requested` instead; already paid orders are ignored. `payment_failed`: logged, the order stays `RESERVED`. `payment_refunded`: the order becomes `REFUNDED`. An unknown order is retried, then dead-lettered. |
| Publishes | `order_confirmed`, `order_cancelled`, `order_expired`, `order_status_changed`, `refund_requested` on `order.events` | Through the outbox (see below). |
| HTTP out | Catalog `POST /internal/reservations`, `DELETE /internal/reservations/{order_id}` | Service JWT (`iss` orders, `aud` catalog), see `docs/contracts/README.md` §5. |

The order id is a UUIDv5 of the user id and `Idempotency-Key`, so concurrent retries share one Catalog reservation and only one insert wins.

**Events.** Each handled event runs in one transaction: its CloudEvent id goes into `processed_events` (a redelivery is skipped), the status changes only if the order is still in the status the handler read (otherwise the transaction rolls back and the consumer retries), and the events to publish go into `outbox`. The outbox relay publishes pending rows every second, in the order they were written, with publisher confirms, and claims rows with `FOR UPDATE SKIP LOCKED` so several instances can run. Publishing is at least once; consumers drop duplicates by CloudEvent id.

**Cancel and status changes** lock the order row (`SELECT … FOR UPDATE`) for the whole decision, so the sweeper skips the order and payment handlers wait, then see the new status; the change and its events are written in one transaction.

**Expiry.** Every 5 seconds the sweeper sets `RESERVED` orders past `expires_at` (30 minutes after creation) to `EXPIRED` and writes an `order_expired` per order to the outbox, in batches of 100, one transaction per batch. It claims orders with `FOR UPDATE SKIP LOCKED`, so several instances can sweep, and a `payment_complete` racing it waits for the row and then requests a refund. Catalog releases the stock and Payment cancels the PaymentIntent on `order_expired`; Catalog's own safety net releases a reservation 5 minutes after `expires_at` if Orders is down.

Not built yet: the `auction_complete` and `user_deleted` consumers.

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3000` | Payment's `ORDERS_URL` points here |
| `DATABASE_URL` | `postgresql://orders:orders@localhost:5433/orders` | compose `orders-db` |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | |
| `CATALOG_URL` | `http://catalog:8080` | For `POST /internal/reservations` |
| `INTERNAL_JWT_SECRET` | random 32+ characters | Shared with Payment and Catalog |
| `SHIPPING_PRICE_MINOR` | `30000` | Flat shipping in øre, default 300 DKK as in the monolith |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
docker compose up -d orders-db rabbitmq   # from microservices/
npm run db:deploy    # apply migrations to DATABASE_URL
npm run dev          # tsx watch
npm test             # Vitest; integration tests start Postgres via testcontainers
```

## Database

Schema: `prisma/schema.prisma`; the Prisma client is generated into `src/generated/` (gitignored) by `npm run build` / `npm run typecheck`, or `npx prisma generate`.

- `npm run db:migrate -- --name <change>` creates a new migration from schema changes (needs a running database).
- Check constraints are not expressible in Prisma, so they are added by hand to the migration SQL (`orders_status_check`).
- The container runs `prisma migrate deploy` on start.
