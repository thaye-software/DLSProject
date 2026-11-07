import { randomUUID } from "node:crypto";
import { listConversations } from "./application/list-conversations.js";
import { listMessages } from "./application/list-messages.js";
import { markRead } from "./application/mark-read.js";
import { noBroadcast } from "./application/ports/chat-broadcaster.js";
import { openConversation } from "./application/open-conversation.js";
import { sendMessage } from "./application/send-message.js";
import { HttpCatalogClient } from "./adapters/catalog/http-catalog-client.js";
import { createApp } from "./adapters/http/app.js";
import { connectToMongo } from "./adapters/mongo/mongo.js";
import { MongoInbox } from "./adapters/mongo/mongo-inbox.js";
import { MongoConversationStore } from "./adapters/mongo/mongo-conversation-store.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { startConsumer } from "./adapters/rabbitmq/consumer.js";
import { assertConsumerTopology } from "./adapters/rabbitmq/topology.js";
import { createUserEventHandlers, USER_EVENTS_EXCHANGE, USER_EVENTS_QUEUE } from "./adapters/rabbitmq/user-events.js";
import { SupabaseBroadcast } from "./adapters/realtime/supabase-broadcast.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const mongo = await connectToMongo(config.mongodbUrl);
const broker = await connectToBroker(config.rabbitmqUrl);

broker.onUnexpectedClose((error) => {
  console.error(
    error ? `RabbitMQ connection lost, exiting: ${error.message}` : "RabbitMQ closed the connection, exiting",
  );
  process.exit(1);
});

const store = new MongoConversationStore(mongo.db);
const inbox = new MongoInbox(mongo.db);
await Promise.all([store.ensureIndexes(), inbox.ensureIndexes()]);

const handlers = createUserEventHandlers({ store, inbox });
await assertConsumerTopology(broker.channel, {
  exchange: USER_EVENTS_EXCHANGE,
  queue: USER_EVENTS_QUEUE,
  routingKeys: Object.keys(handlers),
});
const consumer = await startConsumer(broker.channel, { queue: USER_EVENTS_QUEUE, handlers });

const catalog = new HttpCatalogClient(config.catalogUrl);
const broadcaster =
  config.supabaseUrl && config.supabaseSecretKey
    ? new SupabaseBroadcast({ url: config.supabaseUrl, secretKey: config.supabaseSecretKey })
    : noBroadcast;
const now = () => new Date();
const newId = () => randomUUID();

const app = createApp({
  isBrokerConnected: broker.isOpen,
  isDatabaseReachable: mongo.isReachable,
  openConversation: (viewer, productId) => openConversation(viewer, productId, { store, catalog, now, newId }),
  listConversations: (viewer) => listConversations(viewer, store),
  listMessages: (viewer, conversationId, limit, before) => listMessages(viewer, conversationId, limit, before, store),
  sendMessage: (viewer, conversationId, content, idempotencyKey) =>
    sendMessage(viewer, conversationId, content, idempotencyKey, { store, broadcaster, now }),
  markRead: (viewer, conversationId) => markRead(viewer, conversationId, store, now),
});
const server = app.listen(config.port, () => {
  console.log(`messaging listening on port ${config.port} (realtime: ${broadcaster === noBroadcast ? "off" : "supabase"})`);
});

async function shutdown(): Promise<void> {
  server.close();
  await consumer.stop();
  await broker.close();
  await mongo.close();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
