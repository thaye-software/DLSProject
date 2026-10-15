import { FakePaymentProvider } from "./adapters/fake-payment-provider.js";
import { createApp } from "./adapters/http/app.js";
import { createStripeWebhookHandler } from "./adapters/http/stripe-webhook.js";
import { HttpOrdersClient } from "./adapters/orders/http-orders-client.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { startConsumer } from "./adapters/rabbitmq/consumer.js";
import { createOrderEventHandlers } from "./adapters/rabbitmq/order-events.js";
import { createEventPublisher } from "./adapters/rabbitmq/publisher.js";
import { assertConsumerTopology } from "./adapters/rabbitmq/topology.js";
import { StripePaymentProvider } from "./adapters/stripe/stripe-payment-provider.js";
import { createPaymentSession } from "./application/create-payment-session.js";
import { handlePaymentWebhook } from "./application/handle-payment-webhook.js";
import type { PaymentProvider } from "./application/ports/payment-provider.js";
import { loadConfig } from "./config.js";

const ORDER_EVENTS_EXCHANGE = "order.events";
const ORDER_EVENTS_QUEUE = "payment.order.events";

const config = loadConfig(process.env);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error(
    error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting",
  );
  process.exit(1);
});

const publisher = await createEventPublisher(broker.channel);
const orders = new HttpOrdersClient({ baseUrl: config.ordersUrl, jwtSecret: config.internalJwtSecret });
const payments: PaymentProvider =
  config.paymentProvider.kind === "stripe"
    ? new StripePaymentProvider(config.paymentProvider.secretKey)
    : new FakePaymentProvider();

const orderEventHandlers = createOrderEventHandlers({ payments });
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
  createPaymentSession: (request) => createPaymentSession(request, { orders, payments, now: () => new Date() }),
  stripeWebhook:
    config.paymentProvider.kind === "stripe"
      ? createStripeWebhookHandler({
          webhookSecret: config.paymentProvider.webhookSecret,
          payments,
          handlePaymentWebhook: (webhook) => handlePaymentWebhook(webhook, { publisher }),
        })
      : undefined,
});
const server = app.listen(config.port, () => {
  console.log(`payment listening on port ${config.port} (payment provider: ${config.paymentProvider.kind})`);
});

async function shutdown(): Promise<void> {
  server.close();
  await orderEventsConsumer.stop();
  await broker.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
