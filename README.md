# DLS Project

Limited Watches — monolith under `monolith/`, 
microservices under `microservices/`. 
Architecture notes: `CLAUDE.md`.

## Running the microservices

Needs Docker with Compose 2.20 or newer. From `microservices/`:

```bash
cp .env.example .env
cp orders/.env.example orders/.env
cp payments/.env.example payments/.env
cp emails/.env.example emails/.env
cp users/.env.example users/.env
cp auth/.env.example auth/.env
```

Each service reads its own `.env`. Catalog has no example yet: create `catalog/.env` with `PORT=3002` and the same `INTERNAL_JWT_SECRET` as in `orders/.env` (at least 32 characters). For a local run set `PAYMENT_PROVIDER=fake` in `payments/.env`, `MAILER=fake` in `emails/.env` and `IDENTITY_PROVIDER=fake` in `users/.env`, so no Stripe, Resend or Supabase keys are needed. `INTERNAL_JWT_SECRET` must be the same in Orders, Catalog and Payment. Users also needs a `SUPABASE_WEBHOOK_SECRET` of at least 32 characters. Auth needs your project's `SUPABASE_URL` (and `SUPABASE_JWT_SECRET` if the project still signs tokens with the legacy HS256 secret), plus the same `INTERNAL_JWT_SECRET` as Users.

```bash
docker compose up --build -d
docker compose ps
```

Every service should show `healthy`. Ports: orders 3000, auth 3001, catalog 3002, search 3003, users 3005, payment 3006, notif 3007, RabbitMQ 5672 (management UI on 15672). Stop with `docker compose down` (add `-v` to wipe the databases).

**Choosing what starts.** Each service has its own `docker-compose.yml` in its folder, pulled in by `microservices/docker-compose.yml`. In `microservices/.env`, set `START_CATALOG`, `START_ORDERS`, `START_PAYMENT`, `START_NOTIF`, `START_SEARCH`, `START_USERS` or `START_AUTH` to `false` to skip that service and its database. Keep `COMPOSE_PROFILES=true`; without it only RabbitMQ starts. Orders starts without Catalog, but stock reservation then fails.

Search's index stays empty until Catalog publishes `product_created` (see `DECISIONS.md`).
