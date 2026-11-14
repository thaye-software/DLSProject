import { createApp } from "./app.js";
import { cancelPaymentListener } from "./cancel-payment/cancel-payment-listener.js";
import { loadConfig } from "./config.js";
import { HttpOrdersClient } from "./orders-client/http-orders-client.js";
import { FakePaymentProvider } from "./payment-provider/fake-payment-provider.js";
import type { PaymentProvider } from "./payment-provider/payment-provider.js";
import { StripePaymentProvider } from "./payment-provider/stripe-payment-provider.js";
import { createPaymentSession } from "./payment-session/payment-session-service.js";
import { paymentWebhookController } from "./payment-webhook/payment-webhook-controller.js";
import { handlePaymentWebhook } from "./payment-webhook/payment-webhook-service.js";
import { connectToBroker } from "./rabbitmq/connection.js";
import { startConsumer } from "./rabbitmq/consumer.js";
import { createEventPublisher } from "./rabbitmq/publisher.js";
import { assertConsumerTopology } from "./rabbitmq/topology.js";
import { refundPaymentListener } from "./refund-payment/refund-payment-listener.js";
import { logger } from "./shared/logger.js";

const ORDER_EVENTS_EXCHANGE = "order.events";
const ORDER_EVENTS_QUEUE = "payment.order.events";

// Startup failures (bad config, broker unreachable) and anything else uncaught end up here.
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception, exiting");
  process.exit(1);
});

const config = loadConfig(process.env);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  logger.fatal({ err: error }, "RabbitMQ connection lost, exiting");
  process.exit(1);
});

const publisher = await createEventPublisher(broker.channel);
const orders = new HttpOrdersClient({ baseUrl: config.ordersUrl, jwtSecret: config.internalJwtSecret });
const payments: PaymentProvider =
  config.paymentProvider.kind === "stripe"
    ? new StripePaymentProvider(config.paymentProvider.secretKey)
    : new FakePaymentProvider();

const orderEventHandlers = {
  ...cancelPaymentListener({ payments }),
  ...refundPaymentListener({ payments }),
};
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
      ? paymentWebhookController({
          webhookSecret: config.paymentProvider.webhookSecret,
          payments,
          handlePaymentWebhook: (webhook) => handlePaymentWebhook(webhook, { publisher }),
        })
      : undefined,
});
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, paymentProvider: config.paymentProvider.kind }, "Service listening");
});

async function shutdown(): Promise<void> {
  server.close();
  await orderEventsConsumer.stop();
  await broker.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
