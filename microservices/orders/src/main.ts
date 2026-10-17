import { randomUUID } from "node:crypto";
import { HttpCatalogClient } from "./adapters/catalog/http-catalog-client.js";
import { PrismaExpiryStore } from "./adapters/db/prisma-expiry-store.js";
import { PrismaOrderCommandStore } from "./adapters/db/prisma-order-command-store.js";
import { PrismaOrderEventStore } from "./adapters/db/prisma-order-event-store.js";
import { PrismaOrderRepository } from "./adapters/db/prisma-order-repository.js";
import { createDatabase, isDatabaseReachable } from "./adapters/db/prisma.js";
import { createApp } from "./adapters/http/app.js";
import { startOutboxRelay } from "./adapters/outbox-relay.js";
import { startPolling } from "./adapters/polling.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { startConsumer } from "./adapters/rabbitmq/consumer.js";
import { createPaymentEventHandlers, PAYMENT_EVENTS_EXCHANGE, PAYMENT_EVENTS_QUEUE } from "./adapters/rabbitmq/payment-events.js";
import { createEventPublisher } from "./adapters/rabbitmq/publisher.js";
import { assertConsumerTopology } from "./adapters/rabbitmq/topology.js";
import { cancelOrder, changeOrderStatus } from "./application/change-order.js";
import { createOrder } from "./application/create-order.js";
import { expireDueOrders } from "./application/expire-orders.js";
import { getPaymentDetails } from "./application/get-payment-details.js";
import { getOrder, listOrders } from "./application/read-orders.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const database = createDatabase(config.databaseUrl);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error(
    error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting",
  );
  process.exit(1);
});

const catalog = new HttpCatalogClient({ baseUrl: config.catalogUrl, jwtSecret: config.internalJwtSecret });
const orders = new PrismaOrderRepository(database);
const now = () => new Date();
const changes = { store: new PrismaOrderCommandStore(database), now, newId: randomUUID };

const outboxRelay = startOutboxRelay({ database, publisher: await createEventPublisher(broker.channel) });

// Unpaid orders expire within a few seconds of expires_at; Catalog only releases the stock itself 5 min later.
const EXPIRY_SWEEP_INTERVAL_MS = 5000;
const expiryStore = new PrismaExpiryStore(database);
const expirySweeper = startPolling(
  "Expiry sweeper",
  async () => {
    const expired = await expireDueOrders({ store: expiryStore, now, newId: randomUUID });
    if (expired) console.log(`Expired ${expired} unpaid order(s)`);
  },
  EXPIRY_SWEEP_INTERVAL_MS,
);

const paymentEventHandlers = createPaymentEventHandlers({ store: new PrismaOrderEventStore(database), now, newId: randomUUID });
await assertConsumerTopology(broker.channel, {
  exchange: PAYMENT_EVENTS_EXCHANGE,
  queue: PAYMENT_EVENTS_QUEUE,
  routingKeys: Object.keys(paymentEventHandlers),
});
const paymentEventsConsumer = await startConsumer(broker.channel, { queue: PAYMENT_EVENTS_QUEUE, handlers: paymentEventHandlers });

const app = createApp({
  isBrokerConnected: broker.isOpen,
  isDatabaseReachable: () => isDatabaseReachable(database),
  createOrder: (request) => createOrder(request, { catalog, orders, shippingPriceDkk: config.shippingPriceMinor, now }),
  getOrder: (orderId, viewer) => getOrder(orderId, viewer, orders),
  listOrders: (request) => listOrders(request, orders),
  getPaymentDetails: (orderId) => getPaymentDetails(orderId, { orders, now }),
  cancelOrder: (orderId, viewer) => cancelOrder(orderId, viewer, changes),
  changeOrderStatus: (orderId, status, admin) => changeOrderStatus(orderId, status, admin, changes),
  internalJwtSecret: config.internalJwtSecret,
});
const server = app.listen(config.port, () => {
  console.log(`orders listening on port ${config.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await paymentEventsConsumer.stop();
  await expirySweeper.stop();
  await outboxRelay.stop();
  await broker.close();
  await database.$disconnect();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
