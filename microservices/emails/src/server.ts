import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { sendContactMessage } from "./contact/contact-service.js";
import { FakeMailer } from "./mailer/fake-mailer.js";
import type { Mailer } from "./mailer/mailer.js";
import { ResendMailer } from "./mailer/resend-mailer.js";
import { orderConfirmationListener } from "./order-confirmation/order-confirmation-listener.js";
import { connectToBroker } from "./rabbitmq/connection.js";
import { startConsumer } from "./rabbitmq/consumer.js";
import { assertConsumerTopology } from "./rabbitmq/topology.js";
import { logger } from "./shared/logger.js";

const ORDER_EVENTS_EXCHANGE = "order.events";
const ORDER_EVENTS_QUEUE = "notif.order.events";

const config = loadConfig(process.env);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  logger.fatal({ err: error }, "RabbitMQ connection lost, exiting");
  process.exit(1);
});

const mailer: Mailer = config.mailer.kind === "resend" ? new ResendMailer(config.mailer) : new FakeMailer();

const orderEventHandlers = orderConfirmationListener(mailer);

await assertConsumerTopology(broker.channel, {
  exchange: ORDER_EVENTS_EXCHANGE,
  queue: ORDER_EVENTS_QUEUE,
  routingKeys: Object.keys(orderEventHandlers),
});
const orderEventsConsumer = await startConsumer(broker.channel, {
  queue: ORDER_EVENTS_QUEUE,
  handlers: orderEventHandlers,
});

const app = createApp({
  isBrokerConnected: broker.isOpen,
  sendContactMessage: (contactMessage) => sendContactMessage(contactMessage, mailer),
});
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, mailer: config.mailer.kind }, "Service listening");
});

async function shutdown(): Promise<void> {
  server.close();
  await orderEventsConsumer.stop();
  await broker.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
