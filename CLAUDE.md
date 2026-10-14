# DLS Project

`limited-watches/` is the old project. `microservices/` is the new microservice version, built to the architecture below.

## Architecture v2 (target)

**Entry:** User/Admin Frontend --HTTP--> API Gateway.

**API Gateway (HTTP) routes to:** Authorization, Users, Editorial, Messaging, Catalog, Auctions, Notif/Email.
- Authorization --HTTP--> Users.

**Services and their stores**
- Users: own DB. Publishes to RabbitMQ: `user_created`, `user_deleted`, `notification_setting_changed`, `email_updated`.
- Editorial: BLOB Storage + MongoDB. Calls Catalog over HTTP.
- Messaging: MongoDB. Calls Catalog over HTTP.
- Catalog (write side): Postgres + BLOB Storage. Calls Cloud AI Provider over HTTP. Publishes `product_created`, `product_deleted`, `product_updated` (consumed by both Search and Notif/Email).
- Search (CQRS read side): consumes `product_*` events, keeps MongoDB in sync (MongoDB <-> Postgres = CQRS), served through Redis Cache in front of MongoDB. No gateway route is drawn for it.
- Auctions: own DB. Calls Catalog over HTTP. Publishes `auction_complete`.
- Orders: own DB. Consumes `auction_complete`. Calls Catalog over HTTP. Publishes `order_placed`, `order_cancelled?`, `payment_complete` queue/exchange (the order broker box).
- Payment: DB. Consumes order events, publishes back to the order broker (`payment_complete`).
- Notif / Email: own DB. Consumes `product_*` events, user events (`user_created`, `user_deleted`, `notification_setting_changed`, `email_updated`) and order/payment events. Also reachable from the gateway over HTTP.

**Messaging:** RabbitMQ with separate boxes per publisher: auctions (`auction_complete`), orders/payment (`order_placed`, `order_cancelled?`, `payment_complete`), catalog (`product_*`), users (`user_*`, `notification_setting_changed`, `email_updated`).

Keep service boundaries, sync (HTTP) vs async (RabbitMQ) choices and per-service datastores matching this. Undecided: `order_cancelled?`.
