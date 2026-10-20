import { createApp } from "./adapters/http/app.js";
import { createInMemoryProductRepository } from "./adapters/memory/in-memory-product-repository.js";
import { getProduct } from "./application/get-product.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const products = createInMemoryProductRepository([]);

// Postgres and RabbitMQ are connected in a later commit. Until then neither dependency is reachable.
const app = createApp({
  isBrokerConnected: () => false,
  isDatabaseReachable: async () => false,
  getProduct: (productId) => getProduct(productId, products),
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
