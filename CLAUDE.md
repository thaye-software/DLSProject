# DLS Project

`monolith/limited-watches/` is the old project (Next.js, Drizzle ORM, Supabase, Stripe, Resend). `microservices/` is the new microservice version, built to the architecture below. The goal is to migrate the monolith's existing features, not to add new ones.

**Source of truth:** `microservices/docs/contracts/` — `asyncapi.yaml` (every RabbitMQ message), `openapi.yaml` (every HTTP call that crosses a service boundary) and `README.md` (conventions, topology, delivery guarantees, saga). Diagrams: `microservices/docs/architecture.drawio`, `microservice-erd.drawio` (after) and `monolith-erd.drawio` (before). `microservices/CONTRACTS.md` is an older draft (`order_placed`, camelCase envelope); where it disagrees, `docs/contracts` wins.

## Architecture v3 (target)

**Entry:** User/Admin Frontend --HTTP--> API Gateway. The gateway verifies the Supabase JWT itself (cached signing keys) and forwards `X-User-Id`, `X-User-Role`, `X-User-Email`, `traceparent`. There is no Authorization service. The browser logs in directly with Supabase Auth and confirms card payments directly with Stripe (Stripe.js).

**API Gateway (HTTP) routes to all nine services.** It never routes `/internal/*`; service-to-service calls use `/internal/*` with a service JWT.

**Services and their stores** (folder under `microservices/` in brackets where it exists)
- **Users**: PostgreSQL (`users`, `addresses`, `favorites`), Supabase Storage (avatars), receives the Supabase email-confirmed webhook. Publishes `user_deleted`. Consumes `product_deleted` (removes favorites).
- **Catalog** (write side): PostgreSQL (`products`, `watches`, `brands`, `product_images`), Supabase Storage, Cloud AI provider. Serves `GET /products/{id}` (frontend, Messaging, Editorial, Auctions) and `POST`/`DELETE /internal/reservations` (Orders reserves stock synchronously). Publishes `product_created`, `product_updated`, `product_deleted`, `product_availability_changed`. Consumes `order_confirmed` (mark sold), `order_cancelled`, `order_expired` (release stock).
- **Search** (`search/`, CQRS read side): MongoDB read model (`product_listings`) + Redis cache. Consumes all `catalog.events`; never calls Catalog.
- **Orders** (`orders/`): PostgreSQL (`orders`, `order_items`, `order_addresses` plus `currencies`, `currency_history`, `countries` from the monolith's localization module), ipapi.co for geo-IP. Copies `orders.customer_email`, `order_items.product_name` and `order_items.thumbnail_url` so order reads and `order_confirmed` need no calls to Users/Catalog. Publishes `order_confirmed`, `order_cancelled`, `order_expired`, `refund_requested`. Consumes `auction_complete`, `payment_complete`, `payment_failed`, `payment_refunded`, `user_deleted`.
- **Payment** (`payments/`): **stateless, no DB**; Stripe is the record. `POST /payments` gets the amount from Orders (`GET /internal/orders/{id}/payment-details`) and creates a PaymentIntent (idempotency key = order id). `POST /webhooks/stripe` publishes `payment_complete`, `payment_failed`, `payment_refunded`. Consumes `order_cancelled`, `order_expired` (cancel the PaymentIntent) and `refund_requested`; finds the PaymentIntent via Stripe search on `metadata.order_id`.
- **Notif / Email** (`emails/`): **stateless, no DB**, sends through Resend. Only the emails the monolith sends: order confirmation (consumes `order_confirmed`) and the contact form (`POST /contact`).
- **Messaging**: MongoDB, Supabase Realtime. Calls Catalog over HTTP. Consumes `user_deleted`.
- **Editorial**: MongoDB + Supabase Storage. Calls Catalog over HTTP. Consumes `user_deleted`.
- **Auctions**: own DB (`auctions`, new `bids`). Calls Catalog over HTTP. Publishes `auction_complete`. Consumes `user_deleted`.

**Messaging:** RabbitMQ, one durable topic exchange per publisher: `user.events` (Users), `catalog.events` (Catalog), `auction.events` (Auctions), `order.events` (Orders), `payment.events` (Payment). Routing key = event type. Each consumer has one quorum queue per exchange named `<consumer>.<exchange>`, with dead-letter queue `<queue>.dlq`. Every message is a CloudEvents 1.0 envelope whose `id` is the idempotency key. Services with a DB use a transactional outbox and an idempotent inbox; Payment and Notif use Stripe/Resend idempotency keys instead. User and product events carry an aggregate `version` for ordering.

**Payload conventions:** `snake_case` fields; money is `{ amount_minor, currency }` in minor units, never floats; HTTP errors are RFC 9457 `application/problem+json`.

**Checkout saga:** `POST /orders` → Orders reserves stock in Catalog (sync) → order RESERVED for 30 min → `POST /payments` → browser confirms with Stripe.js → Stripe webhook → `payment_complete` → Orders sets PENDING and publishes `order_confirmed` → Notif emails, Catalog marks sold. Compensation: `order_expired`/`order_cancelled` → Catalog releases stock, Payment cancels the PaymentIntent; a payment after expiry → `refund_requested` → `payment_refunded` → order REFUNDED.

Keep service boundaries, sync (HTTP) vs async (RabbitMQ) choices and per-service datastores matching this. To change a contract, update `docs/contracts` first, then the code and diagrams. Undecided: how a watch on auction is withheld from normal checkout, and the Auctions DB technology (PostgreSQL is the no-change choice).
