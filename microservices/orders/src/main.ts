import { createDatabase, isDatabaseReachable } from "./adapters/db/prisma.js";
import { createApp } from "./adapters/http/app.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
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

const app = createApp({
  isBrokerConnected: broker.isOpen,
  isDatabaseReachable: () => isDatabaseReachable(database),
});
const server = app.listen(config.port, () => {
  console.log(`orders listening on port ${config.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await broker.close();
  await database.$disconnect();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
