import { createApp } from "./adapters/http/app.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error("RabbitMQ connection lost, exiting", error);
  process.exit(1);
});

const app = createApp({ isBrokerConnected: broker.isOpen });
const server = app.listen(config.port, () => {
  console.log(`notif listening on port ${config.port} (mailer: ${config.mailer.kind})`);
});

async function shutdown(): Promise<void> {
  server.close();
  await broker.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
