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
```

Each service reads its own `.env`. Catalog has no example yet: create `catalog/.env` with `PORT=3002` and the same `INTERNAL_JWT_SECRET` as in `orders/.env` (at least 32 characters). For a local run set `PAYMENT_PROVIDER=fake` in `payments/.env` and `MAILER=fake` in `emails/.env`, so no Stripe or Resend keys are needed. `INTERNAL_JWT_SECRET` must be the same in Orders, Catalog and Payment.

```bash
docker compose up --build -d
docker compose ps
```

Every service should show `healthy`. Ports: orders 3000, catalog 3002, search 3003, payment 3006, notif 3007, RabbitMQ 5672 (management UI on 15672). Stop with `docker compose down` (add `-v` to wipe the databases).

**Choosing what starts.** Each service has its own `docker-compose.yml` in its folder, pulled in by `microservices/docker-compose.yml`. In `microservices/.env`, set `START_CATALOG`, `START_ORDERS`, `START_PAYMENT`, `START_NOTIF` or `START_SEARCH` to `false` to skip that service and its database. Keep `COMPOSE_PROFILES=true`; without it only RabbitMQ starts. Orders starts without Catalog, but stock reservation then fails.

Search's index stays empty until Catalog publishes `product_created` (see `DECISIONS.md`).
