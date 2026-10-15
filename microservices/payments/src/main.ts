import { FakePaymentProvider } from "./adapters/fake-payment-provider.js";
import { createApp } from "./adapters/http/app.js";
import { HttpOrdersClient } from "./adapters/orders/http-orders-client.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { StripePaymentProvider } from "./adapters/stripe/stripe-payment-provider.js";
import { createPaymentSession } from "./application/create-payment-session.js";
import type { PaymentProvider } from "./application/ports/payment-provider.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error(
    error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting",
  );
  process.exit(1);
});

const orders = new HttpOrdersClient({ baseUrl: config.ordersUrl, jwtSecret: config.internalJwtSecret });
const payments: PaymentProvider =
  config.paymentProvider.kind === "stripe"
    ? new StripePaymentProvider(config.paymentProvider.secretKey)
    : new FakePaymentProvider();

const app = createApp({
  isBrokerConnected: broker.isOpen,
  createPaymentSession: (request) => createPaymentSession(request, { orders, payments, now: () => new Date() }),
});
const server = app.listen(config.port, () => {
  console.log(`payment listening on port ${config.port} (payment provider: ${config.paymentProvider.kind})`);
});

async function shutdown(): Promise<void> {
  server.close();
  await broker.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
