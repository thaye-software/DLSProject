import { MongoInbox } from "./adapters/mongo/mongo-inbox.js";
import { MongoListingStore } from "./adapters/mongo/mongo-listing-store.js";
import { connectToMongo } from "./adapters/mongo/mongo.js";
import { createApp } from "./adapters/http/app.js";
import { CATALOG_EVENTS_EXCHANGE, CATALOG_EVENTS_QUEUE, createCatalogEventHandlers } from "./adapters/rabbitmq/catalog-events.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { startConsumer } from "./adapters/rabbitmq/consumer.js";
import { assertConsumerTopology } from "./adapters/rabbitmq/topology.js";
import { connectToRedis, noCache, type RedisCache } from "./adapters/redis/redis-search-cache.js";
import { searchListings } from "./application/search-listings.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const mongo = await connectToMongo(config.mongodbUrl);
const redis: RedisCache | null = config.redisUrl ? await connectToRedis(config.redisUrl) : null;
const cache = redis ?? noCache;
const broker = await connectToBroker(config.rabbitmqUrl);

// Reconnecting is left to the container runtime: compose restarts the service when it exits.
broker.onUnexpectedClose((error) => {
  console.error(
    error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting",
  );
  process.exit(1);
});

const store = new MongoListingStore(mongo.db);
const inbox = new MongoInbox(mongo.db);
await Promise.all([store.ensureIndexes(), inbox.ensureIndexes()]);

const handlers = createCatalogEventHandlers({ store, inbox, cache });
await assertConsumerTopology(broker.channel, {
  exchange: CATALOG_EVENTS_EXCHANGE,
  queue: CATALOG_EVENTS_QUEUE,
  routingKeys: Object.keys(handlers),
});
// One event at a time: handling several at once would reopen small races between events for the same product
// (an availability change running beside its own product_created, a snapshot beside a brand rename).
// Catalog's event volume is tiny, so serial handling costs nothing; run one instance.
const consumer = await startConsumer(broker.channel, { queue: CATALOG_EVENTS_QUEUE, handlers, prefetch: 1 });

const app = createApp({
  isBrokerConnected: broker.isOpen,
  isDatabaseReachable: mongo.isReachable,
  search: (query) => searchListings(query, { store, cache }),
});
const server = app.listen(config.port, () => {
  console.log(`search listening on port ${config.port} (cache: ${redis ? "redis" : "off"})`);
});

async function shutdown(): Promise<void> {
  server.close();
  await consumer.stop();
  await broker.close();
  await redis?.close();
  await mongo.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
