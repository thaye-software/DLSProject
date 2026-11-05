# Payment

Takes the customer's money for a reserved order through Stripe, and refunds it on request. Stateless: no database, Stripe is the record. Migrates the monolith's PaymentIntent creation (`monolith/.../app/orders/checkout/payment/page.tsx`) and Stripe webhook (`monolith/.../app/api/webhooks/stripe/route.ts`).

Contracts: `../docs/contracts/openapi.yaml` (`POST /payments`, `POST /webhooks/stripe`, Orders' `GET /internal/orders/{order_id}/payment-details`) and `../docs/contracts/asyncapi.yaml`.

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `POST /payments` | Public via gateway, trusts `X-User-Id`. Creates or returns the order's PaymentIntent (idempotency key = order id). `404` if the order is missing or belongs to someone else, `409` if it is not RESERVED. |
| HTTP in | `POST /webhooks/stripe` | Public, `Stripe-Signature` verified. Answers `200` only after RabbitMQ confirms the publish, otherwise `500` so Stripe retries. Events for PaymentIntents without `order_id`/`user_id` metadata (not created by Payment) get `200` and are ignored. Not served when `PAYMENT_PROVIDER=fake`. |
| HTTP in | `GET /health` | `200` when the RabbitMQ channel is open. |
| HTTP out | Orders `GET /internal/orders/{order_id}/payment-details` | Service JWT, see `docs/contracts/README.md` §5. |
| Publishes | `payment_complete`, `payment_failed`, `payment_refunded` on `payment.events` | CloudEvent `id` = UUIDv5 of the Stripe event id. |
| RabbitMQ in | `order_cancelled`, `order_expired`, `refund_requested` on `order.events` | Queue `payment.order.events`, dead letters to `payment.order.events.dlq`. Each handled event logs its outcome (`no_intent`, `already_canceled`, `already_paid`, `cancelled`, `not_cancellable`). |

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3006` | |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672` | |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Not needed when `PAYMENT_PROVIDER=fake` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From the dashboard, or printed by `stripe listen` |
| `ORDERS_URL` | `http://orders:3000` | |
| `INTERNAL_JWT_SECRET` | random 32+ bytes | Shared with Orders |
| `PAYMENT_PROVIDER` | `stripe` | `fake` keeps PaymentIntents in memory (k6 load runs) |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
npm run dev          # tsx watch, needs RabbitMQ on RABBITMQ_URL
npm test             # Vitest; integration tests use Stripe test mode and RabbitMQ via testcontainers
stripe listen --forward-to localhost:3006/webhooks/stripe   # real webhooks locally
```

`STRIPE_WEBHOOK_SECRET` must be the secret `stripe listen` prints (`stripe listen --print-secret`). `stripe trigger` only reaches RabbitMQ when the PaymentIntent carries order metadata:

```bash
stripe trigger payment_intent.succeeded --add "payment_intent:currency=dkk" --add "payment_intent:metadata[order_id]=<order uuid>" --add "payment_intent:metadata[user_id]=<user uuid>"
```

The whole cluster runs from `microservices/docker-compose.yml`:

```bash
docker compose up --build rabbitmq notif payment
```

| Service | Port | |
|---|---|---|
| RabbitMQ | `5672`, management UI `15672` (guest/guest) | |
| Payment | `3006` | |
| Notif | `3007` | |

## Layout

Package by feature, with each feature split into layers:

```
src/
  payment-session/     POST /payments
    payment-session-controller.ts   route + X-User-Id/body validation
    payment-session-service.ts      createPaymentSession (Orders lookup, Stripe intent)
    payment-session-types.ts
  payment-webhook/     POST /webhooks/stripe
    payment-webhook-controller.ts   signature check, Stripe event -> PaymentWebhook
    payment-webhook-service.ts      handlePaymentWebhook (publishes to payment.events)
    payment-webhook-types.ts
  cancel-payment/      order_cancelled, order_expired
    cancel-payment-listener.ts
    cancel-payment-schema.ts
    cancel-payment-service.ts
  refund-payment/      refund_requested
    refund-payment-listener.ts
    refund-payment-schema.ts
    refund-payment-service.ts
    refund-payment-types.ts
  payment-provider/    PaymentProvider interface, Stripe + fake implementations, order metadata
  orders-client/       OrdersClient interface, HTTP client (service JWT)
  rabbitmq/            connection, consumer, publisher + EventPublisher interface, retry, topology, CloudEvent parsing
  shared/              Money, payment CloudEvent builder, UUIDv5, problem+json responses
  app.ts               Express app: /health + feature routers
  config.ts            env vars validated with zod at startup
  server.ts            entry point: wires config, broker, providers, listeners and HTTP
```

Within a feature, controller/listener -> service -> types. Services depend only on the `PaymentProvider`, `OrdersClient` and `EventPublisher` interfaces, and only `server.ts` picks the concrete implementations.

## Order of events

Every consumer is safe whatever order its messages arrive in relative to the Stripe webhooks:

- `order_cancelled` / `order_expired`: no PaymentIntent found, already `canceled`, already `succeeded`, or Stripe refuses to cancel → ack and do nothing. A succeeded payment is refunded only when Orders asks with `refund_requested`.
- `refund_requested`: refunds the event's `amount` with `refund_request_id` as Stripe idempotency key and refund metadata, so a redelivery returns the same refund. If the PaymentIntent has not succeeded yet, or Stripe Search does not find it yet, the handler fails and retries (1, 2, 4, 8, 8 s), then goes to the DLQ. An `amount_minor` of 0 goes to the DLQ at once. `payment_refunded` comes from the `charge.refunded` webhook, which reads `refund_request_id` back from the refund.

## Known limitations

- **Stripe Search lags by up to about a minute.** An `order_cancelled` that arrives seconds after `POST /payments` may not find the PaymentIntent, which then stays open. While it catches up, Search can also return a PaymentIntent and then miss it on the next query (seen in test mode: settled after about 45 s). If the customer pays it anyway, Orders receives `payment_complete` for a cancelled order and sends `refund_requested`, so the money goes back.
- Prices are DKK only. Payment still passes the `currency` from Orders to Stripe instead of hardcoding it.
