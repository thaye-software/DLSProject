# Notif

Sends the shop's emails through Resend. Stateless: no database. Migrates the two emails the monolith sends: the order confirmation (`monolith/.../app/orders/actions.ts`) and the contact message (`monolith/.../app/contact/actions.ts`).

Contracts: `../docs/contracts/openapi.yaml` (`POST /contact`) and `../docs/contracts/asyncapi.yaml` (`order_confirmed`).

## Interface

| Direction | What | Notes |
|---|---|---|
| HTTP in | `POST /contact` | Public via gateway, no JWT. `202` sent, `422` invalid body, `502` Resend failed. Emails the message to the address the sender entered, as the monolith does. |
| HTTP in | `GET /health` | `200` when the RabbitMQ channel is open. Used by the compose healthcheck and k6. |
| RabbitMQ in | `order_confirmed` on `order.events` | Queue `notif.order.events`, dead letters to `notif.order.events.dlq`. Sends the order confirmation with the CloudEvent `id` as Resend idempotency key. |
| Publishes | nothing | |

## Configuration

| Variable | Example | |
|---|---|---|
| `PORT` | `3007` | |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672` | |
| `RESEND_API_KEY` | `re_...` | Not needed when `MAILER=fake` |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | Without a verified domain Resend only sends from this address |
| `MAILER` | `resend` | `fake` keeps emails in memory (k6 load runs) |

Copy `.env.example` to `.env`; `.env` is gitignored.

## Running

```bash
npm install
npm run dev          # tsx watch, needs RabbitMQ on RABBITMQ_URL
npm test             # Vitest; integration tests start RabbitMQ with testcontainers (Docker must run)
```

The whole cluster runs from `microservices/docker-compose.yml`:

```bash
docker compose up --build rabbitmq notif
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
  contact/
    contact-controller.ts            POST /contact (Express router + zod body validation)
    contact-service.ts               sendContactMessage use case
    contact-template.ts              renders the email
    contact-types.ts
  order-confirmation/
    order-confirmation-listener.ts   order.events handlers (order_confirmed)
    order-confirmation-schema.ts     zod schema for the event data
    order-confirmation-service.ts    sendOrderConfirmation use case
    order-confirmation-template.ts   renders the email
    order-confirmation-types.ts
  mailer/          Mailer interface, ResendMailer, FakeMailer
  rabbitmq/        connection, consumer, retry, topology, CloudEvent parsing
  shared/          Email type, HTML escaping, DKK formatting, problem+json responses
  app.ts           Express app: /health + feature routers
  config.ts        env vars validated with zod at startup
  server.ts        entry point: wires config, broker, mailer, listeners and HTTP
```

Within a feature, controller/listener → service → template. Services depend only on the `Mailer` interface, and only `server.ts` picks the concrete mailer.

## Delivery

Consumers ack only after the handler succeeds. A failing handler is retried in-process after 1, 2, 4, 8 and 8 s, then rejected into the DLQ. Redelivery is safe because Resend deduplicates on the CloudEvent `id` (for 24 h).
