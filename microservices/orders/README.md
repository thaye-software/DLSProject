# Orders

Owns orders from reservation to delivery: creates them (reserving stock in Catalog), tracks payment through `payment.events`, expires unpaid ones after 30 minutes and lets admins move them forward. PostgreSQL through Prisma.

Contracts: `contract.md` (summary), `../docs/contracts/openapi.yaml` and `../docs/contracts/asyncapi.yaml`. Open questions: `../../DECISIONS.md`.

**Status: scaffold.** Only `GET /health` is served so far.

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
