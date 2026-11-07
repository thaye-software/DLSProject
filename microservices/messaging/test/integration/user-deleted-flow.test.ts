import { randomUUID } from "node:crypto";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type Channel, type ChannelModel } from "amqplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoInbox } from "../../src/adapters/mongo/mongo-inbox.js";
import { MongoConversationStore } from "../../src/adapters/mongo/mongo-conversation-store.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { startConsumer, type Consumer } from "../../src/adapters/rabbitmq/consumer.js";
import { assertConsumerTopology } from "../../src/adapters/rabbitmq/topology.js";
import { createUserEventHandlers, USER_EVENTS_EXCHANGE, USER_EVENTS_QUEUE } from "../../src/adapters/rabbitmq/user-events.js";
import { asyncApi } from "../support/contract.js";
import { startMongo, type TestMongo } from "../support/containers.js";
import { startRabbitMq } from "../support/rabbitmq.js";
import { CONVERSATION_ID, customer, NOW, PRODUCT_ID, product } from "../fixtures/chat.js";

const BROKER_WAIT = { timeout: 15_000 };

let mongo: TestMongo;
let rabbit: StartedRabbitMQContainer;
let store: MongoConversationStore;
let broker: BrokerConnection;
let consumer: Consumer;
let publisherConnection: ChannelModel;
let publisher: Channel;

beforeAll(async () => {
  [mongo, rabbit] = await Promise.all([startMongo(), startRabbitMq()]);
  store = new MongoConversationStore(mongo.mongo.db);
  const inbox = new MongoInbox(mongo.mongo.db);
  await Promise.all([store.ensureIndexes(), inbox.ensureIndexes()]);
  await store.insert({
    conversationId: CONVERSATION_ID,
    customerUserId: customer.userId,
    customerDisplayName: "mette",
    productId: PRODUCT_ID,
    productName: product.name,
    thumbnailUrl: product.thumbnailUrl,
    now: NOW,
  });

  broker = await connectToBroker(rabbit.getAmqpUrl());
  const handlers = createUserEventHandlers({ store, inbox });
  await assertConsumerTopology(broker.channel, {
    exchange: USER_EVENTS_EXCHANGE,
    queue: USER_EVENTS_QUEUE,
    routingKeys: Object.keys(handlers),
  });
  consumer = await startConsumer(broker.channel, { queue: USER_EVENTS_QUEUE, handlers, retryDelaysMs: [5, 5, 5, 5, 5] });

  publisherConnection = await connect(rabbit.getAmqpUrl());
  publisher = await publisherConnection.createChannel();
});

afterAll(async () => {
  await consumer?.stop();
  await broker?.close();
  await publisherConnection?.close();
  await mongo?.mongo?.close();
  await Promise.all([mongo?.container?.stop(), rabbit?.stop()]);
});

describe("user_deleted flow", () => {
  it("anonymises the customer's display name from the contract example", async () => {
    const example = asyncApi.components.messages.UserDeleted.examples[0].payload;
    publisher.publish(USER_EVENTS_EXCHANGE, "user_deleted", Buffer.from(JSON.stringify({ ...example, id: randomUUID() })), {
      persistent: true,
    });

    await vi.waitFor(async () => {
      expect((await store.findById(CONVERSATION_ID))?.customerDisplayName).toBe("Deleted User");
    }, BROKER_WAIT);
  });
});
