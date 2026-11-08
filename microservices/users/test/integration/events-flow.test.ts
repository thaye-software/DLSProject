import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { connect, type ChannelModel, type ConsumeMessage } from "amqplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaUserStore } from "../../src/adapters/db/prisma-user-store.js";
import { createDatabase, type Database } from "../../src/adapters/db/prisma.js";
import { createApp } from "../../src/adapters/http/app.js";
import { startOutboxRelay, type OutboxRelay } from "../../src/adapters/outbox-relay.js";
import { connectToBroker, type BrokerConnection } from "../../src/adapters/rabbitmq/connection.js";
import { createEventPublisher, USER_EVENTS_EXCHANGE } from "../../src/adapters/rabbitmq/publisher.js";
import { FakeAvatarStorage, FakeIdentityProvider } from "../../src/adapters/supabase/supabase.js";
import { deleteAccount } from "../../src/application/delete-account.js";
import { purgeDeletedAccounts } from "../../src/application/purge-deleted-accounts.js";
import { syncConfirmedEmail } from "../../src/application/sync-email.js";
import { updateProfile } from "../../src/application/update-profile.js";
import { uploadAvatar } from "../../src/application/upload-avatar.js";
import { eventSchema } from "../support/contract.js";
import { startMigratedPostgres } from "../support/postgres.js";
import { startRabbitMq } from "../support/rabbitmq.js";
import { INTERNAL_JWT_SECRET, WEBHOOK_SECRET } from "../support/serve.js";

const BROKER_WAIT = { timeout: 15_000 };

let postgres: StartedPostgreSqlContainer;
let rabbit: StartedRabbitMQContainer;
let database: Database;
let users: PrismaUserStore;
let broker: BrokerConnection;
let relay: OutboxRelay;
let server: Server;
let baseUrl: string;
// A plain client standing in for the user.events consumers (Orders, Catalog, Messaging, Editorial, Auctions).
let testConnection: ChannelModel;
const userEvents: ConsumeMessage[] = [];
const identity = new FakeIdentityProvider();
const avatars = new FakeAvatarStorage("http://localhost:3005");

beforeAll(async () => {
  [postgres, rabbit] = await Promise.all([startMigratedPostgres(), startRabbitMq()]);
  database = createDatabase(postgres.getConnectionUri());
  users = new PrismaUserStore(database);

  testConnection = await connect(rabbit.getAmqpUrl());
  const channel = await testConnection.createChannel();
  await channel.assertExchange(USER_EVENTS_EXCHANGE, "topic", { durable: true });
  const { queue } = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(queue, USER_EVENTS_EXCHANGE, "#");
  await channel.consume(queue, (message) => message && userEvents.push(message), { noAck: true });

  // Wired as in main.ts, with a short relay interval and the fake Supabase adapters.
  broker = await connectToBroker(rabbit.getAmqpUrl());
  relay = startOutboxRelay({ database, publisher: await createEventPublisher(broker.channel), intervalMs: 50 });
  const now = () => new Date();
  server = createApp({
    isBrokerConnected: broker.isOpen,
    isDatabaseReachable: async () => true,
    createUser: (user) => users.create(user),
    isUsernameTaken: (username) => users.isUsernameTaken(username),
    getProfile: (userId) => users.findActive(userId),
    updateProfile: (userId, changes) => updateProfile(userId, changes, { users, identity }),
    setAddress: (userId, address) => users.setAddress(userId, address),
    removeAddress: (userId) => users.removeAddress(userId),
    uploadAvatar: (userId, contentType, bytes) => uploadAvatar(userId, contentType, bytes, { users, avatars }),
    deleteAccount: (userId) => deleteAccount(userId, { users, now, newId: randomUUID }),
    getUser: (userId) => users.find(userId),
    syncConfirmedEmail: (update) => syncConfirmedEmail(update, users),
    internalJwtSecret: INTERNAL_JWT_SECRET,
    supabaseWebhookSecret: WEBHOOK_SECRET,
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await relay?.stop();
  await broker?.close();
  await testConnection?.close();
  await database?.$disconnect();
  await Promise.all([postgres?.stop(), rabbit?.stop()]);
});

const eventsFor = (userId: string) => userEvents.filter((message) => JSON.parse(message.content.toString()).subject === userId);

describe("HTTP → Users → user.events", () => {
  it("signs up, edits the profile, deletes the account and publishes one contract-valid user_deleted", async () => {
    const userId = randomUUID();
    const headers = { "content-type": "application/json", "x-user-id": userId, "x-user-email": "mette@example.com" };

    const created = await fetch(`${baseUrl}/users`, { method: "POST", headers, body: JSON.stringify({ username: "mette_j" }) });
    expect(created.status).toBe(201);
    const patched = await fetch(`${baseUrl}/users/me`, { method: "PATCH", headers, body: JSON.stringify({ first_name: "Mette" }) });
    expect((await patched.json()).version).toBe(2);

    const deleted = await fetch(`${baseUrl}/users/me`, { method: "DELETE", headers });
    expect(deleted.status).toBe(204);
    expect((await fetch(`${baseUrl}/users/me`, { method: "DELETE", headers })).status).toBe(204);

    await vi.waitFor(() => expect(eventsFor(userId)).toHaveLength(1), BROKER_WAIT);
    const [message] = eventsFor(userId);
    const event = JSON.parse(message!.content.toString());
    const validate = eventSchema("UserDeletedEvent");
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
    expect(event).toMatchObject({ source: "/services/users", subject: userId, data: { user_id: userId, version: 3 } });
    expect(message!.fields.routingKey).toBe("user_deleted");
    expect(message!.properties).toMatchObject({ contentType: "application/cloudevents+json", messageId: event.id, deliveryMode: 2 });

    // The profile is gone for the user; the gateway sees the account as deleted.
    expect((await fetch(`${baseUrl}/users/me`, { headers })).status).toBe(404);
    expect(await database.outboxEvent.count({ where: { id: event.id, publishedAt: { not: null } } })).toBe(1);
  });

  it("purges the Supabase account of a deleted user once", async () => {
    const userId = randomUUID();
    await users.create({ id: userId, username: `purge_${userId.slice(0, 8)}`, email: `${userId.slice(0, 8)}@example.com` });
    await deleteAccount(userId, { users, now: () => new Date(), newId: randomUUID });
    const deleteUser = vi.spyOn(identity, "deleteUser");

    await purgeDeletedAccounts({ users, identity, avatars, now: () => new Date(), batchSize: 1000 });
    await purgeDeletedAccounts({ users, identity, avatars, now: () => new Date(), batchSize: 1000 });

    expect(deleteUser.mock.calls.filter(([id]) => id === userId)).toHaveLength(1);
  });
});
