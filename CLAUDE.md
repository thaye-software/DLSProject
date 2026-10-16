# DLS Project

`monolith/limited-watches/` is the old project. `microservices/` is the new microservice version, built to the architecture below. Per-service database tables (ERD) and event payloads (CloudEvents envelope, shared types, order statuses) for Orders and Search: `microservices/orders/contract.md` and `microservices/search/contract.md`, taken from the team's Event contracts sheet.

## Architecture v3 (target)

**Edge:** User/Admin Frontend --HTTP--> API Gateway (verifies JWT, routes). There is no Authorization service: login goes straight to Supabase Auth, and the gateway verifies JWTs using its signing keys. The frontend also talks to Supabase Realtime (WebSocket, chat), Stripe (Stripe.js payment confirm) and PostHog (analytics).

**API Gateway (HTTP/REST) routes to:** Search, Users, Editorial, Messaging, Catalog, Auctions, Orders, Payment, Notif/Email.

**Services, stores and external SaaS**
- Search: MongoDB read model + Redis cache.
- Users: PostgreSQL. Supabase DB webhook (email-confirmed) in, Supabase Storage (avatars).
- Editorial: MongoDB. Supabase Storage (blog media). Calls Catalog over HTTP.
- Messaging: MongoDB. Broadcasts via Supabase Realtime. Calls Catalog over HTTP.
- Catalog: PostgreSQL. Supabase Storage (product images), Cloud AI provider. Callee of HTTP from Editorial, Messaging, Auctions and Orders.
- Auctions: own DB. Calls Catalog over HTTP.
- Orders: PostgreSQL. ipapi.co (geo-IP). Calls Catalog over HTTP to reserve stock. Payment calls Orders over HTTP.
- Payment: stateless, no DB. Stripe (create intent out, webhook in).
- Notif / Email: stateless, no DB. Resend (email).

**Async: RabbitMQ, one exchange per publisher**
- `user.events` (Users): `user_deleted` -> Orders, Catalog, Messaging, Editorial, Auctions.
- `catalog.events` (Catalog): `product_created`, `product_updated`, `product_deleted`, `product_availability_changed`, `brand_updated` -> Search.
- `auction.events` (Auctions): `auction_complete` -> Orders.
- `order.events` (Orders): `order_confirmed` -> Notif/Email, Catalog; `order_cancelled` -> Catalog, Payment; `order_expired` -> Catalog, Payment; `order_status_changed` -> Catalog; `refund_requested` -> Payment.
- `payment.events` (Payment): `payment_complete`, `payment_failed`, `payment_refunded` -> Orders.

Keep service boundaries, sync (HTTP) vs async (RabbitMQ) choices and per-service datastores matching this.
