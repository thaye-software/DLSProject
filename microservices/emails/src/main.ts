import { FakeMailer } from "./adapters/fake-mailer.js";
import { createApp } from "./adapters/http/app.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { startConsumer, type EventHandler } from "./adapters/rabbitmq/consumer.js";
import { assertConsumerTopology } from "./adapters/rabbitmq/topology.js";
import { ResendMailer } from "./adapters/resend/resend-mailer.js";
import type { Mailer } from "./application/ports/mailer.js";
import { sendContactMessage } from "./application/send-contact-message.js";
import { loadConfig } from "./config.js";

const ORDER_EVENTS_EXCHANGE = "order.events";
const ORDER_EVENTS_QUEUE = "notif.order.events";

const config = loadConfig(process.env);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error(
    error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting",
  );
  process.exit(1);
});

const mailer: Mailer = config.mailer.kind === "resend" ? new ResendMailer(config.mailer) : new FakeMailer();

const orderEventHandlers: Record<string, EventHandler> = {};

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
  console.log(`notif listening on port ${config.port} (mailer: ${config.mailer.kind})`);
});

async function shutdown(): Promise<void> {
  server.close();
  await orderEventsConsumer.stop();
  await broker.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
