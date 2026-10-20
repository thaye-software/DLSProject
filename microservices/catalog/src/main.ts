import { randomUUID } from "node:crypto";
import { createApp } from "./adapters/http/app.js";
import { createInMemoryReservationStore } from "./adapters/memory/in-memory-reservation-store.js";
import { releaseReservation } from "./application/release-reservation.js";
import { reserveStock } from "./application/reserve-stock.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const reservations = createInMemoryReservationStore([]);
const reservationContext = { store: reservations, now: () => new Date(), newId: randomUUID };

// Postgres and RabbitMQ are connected in a later commit. Until then neither dependency is reachable.
const app = createApp({
  isBrokerConnected: () => false,
  isDatabaseReachable: async () => false,
  getProduct: (productId) => reservations.product(productId),
  reserveStock: (request) => reserveStock(request, reservationContext),
  releaseReservation: (orderId) => releaseReservation(orderId, reservationContext),
  internalJwtSecret: config.internalJwtSecret,
});

const server = app.listen(config.port, () => {
  console.log(`catalog listening on port ${config.port}`);
});

function shutdown(): void {
  server.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
