# DLS Project

`limited-watches/` is the old project. `microservices/` is the new microservice version, built to the architecture below. Event payloads (CloudEvents envelope, shared types, order statuses) for Orders and Search: `microservices/CONTRACTS.md`, taken from the team's Event contracts sheet.

## Architecture v3 (target)

**Edge:** User/Admin Frontend --HTTP--> API Gateway (routes). Login, signup and token refresh go straight to Supabase Auth, which issues the user JWTs. For every protected route the gateway asks the Auth service (`GET /verify`, forward-auth), which checks the JWT against Supabase's signing keys and answers `X-User-Id` / `X-User-Email` / `X-User-Role`. The role comes from Users. The frontend also talks to Supabase Realtime (WebSocket, chat), Stripe (Stripe.js payment confirm) and PostHog (analytics).

**API Gateway (HTTP/REST) routes to:** Search, Users, Editorial, Messaging, Catalog, Auctions, Orders, Payment, Notif/Email.

**Services, stores and external SaaS**
- Auth: stateless, no DB. Forward-auth for the gateway. Verifies Supabase JWTs (JWKS) and gets the role from Users over HTTP (cached 30 s). Issues no tokens.
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
