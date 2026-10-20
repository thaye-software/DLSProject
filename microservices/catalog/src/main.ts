import { createApp } from "./adapters/http/app.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);

// Postgres and RabbitMQ are connected in a later commit. Until then neither dependency is reachable.
const app = createApp({
  isBrokerConnected: () => false,
  isDatabaseReachable: async () => false,
});

const server = app.listen(config.port, () => {
  console.log(`catalog listening on port ${config.port}`);
});

function shutdown(): void {
  server.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
