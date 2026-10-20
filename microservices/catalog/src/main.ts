import { randomUUID } from "node:crypto";
import { isDatabaseReachable, createDatabase } from "./adapters/db/prisma.js";
import { PrismaProductRepository } from "./adapters/db/prisma-product-repository.js";
import { PrismaReservationStore } from "./adapters/db/prisma-reservation-store.js";
import { seedCatalog } from "./adapters/db/seed.js";
import { createApp } from "./adapters/http/app.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { startReservationSafetyNet } from "./adapters/safety-net.js";
import { releaseReservation } from "./application/release-reservation.js";
import { reserveStock } from "./application/reserve-stock.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const database = createDatabase(config.databaseUrl);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error(error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting");
  process.exit(1);
});

await seedCatalog(database);

const products = new PrismaProductRepository(database);
const reservations = new PrismaReservationStore(database);
const reservationContext = { store: reservations, now: () => new Date(), newId: randomUUID };
const safetyNet = startReservationSafetyNet(reservationContext);

// The channel is open for health. Publishing catalog.events waits until the outbox relay exists.
const app = createApp({
  isBrokerConnected: broker.isOpen,
  isDatabaseReachable: () => isDatabaseReachable(database),
  getProduct: (productId) => products.findById(productId),
  reserveStock: (request) => reserveStock(request, reservationContext),
  releaseReservation: (orderId) => releaseReservation(orderId, reservationContext),
  internalJwtSecret: config.internalJwtSecret,
});

const server = app.listen(config.port, () => {
  console.log(`catalog listening on port ${config.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await safetyNet.stop();
  await broker.close();
  await database.$disconnect();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
