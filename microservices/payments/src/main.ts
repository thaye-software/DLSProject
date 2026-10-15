import { createApp } from "./adapters/http/app.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
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

const app = createApp({ isBrokerConnected: broker.isOpen });
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
