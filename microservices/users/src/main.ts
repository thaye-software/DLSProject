import { randomUUID } from "node:crypto";
import { PrismaUserStore } from "./adapters/db/prisma-user-store.js";
import { createDatabase, isDatabaseReachable } from "./adapters/db/prisma.js";
import { createApp } from "./adapters/http/app.js";
import { startOutboxRelay } from "./adapters/outbox-relay.js";
import { startPolling } from "./adapters/polling.js";
import { connectToBroker } from "./adapters/rabbitmq/connection.js";
import { createEventPublisher } from "./adapters/rabbitmq/publisher.js";
import {
  createSupabaseAdmin,
  FakeAvatarStorage,
  FakeIdentityProvider,
  SupabaseAvatarStorage,
  SupabaseIdentityProvider,
} from "./adapters/supabase/supabase.js";
import { deleteAccount } from "./application/delete-account.js";
import type { AvatarStorage } from "./application/ports/avatar-storage.js";
import type { IdentityProvider } from "./application/ports/identity-provider.js";
import { purgeDeletedAccounts } from "./application/purge-deleted-accounts.js";
import { syncConfirmedEmail } from "./application/sync-email.js";
import { updateProfile } from "./application/update-profile.js";
import { uploadAvatar } from "./application/upload-avatar.js";
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

let identity: IdentityProvider;
let avatars: AvatarStorage;
if (config.identity.kind === "supabase") {
  const supabase = createSupabaseAdmin(config.identity);
  identity = new SupabaseIdentityProvider(supabase);
  avatars = new SupabaseAvatarStorage(supabase, config.identity.avatarBucket);
} else {
  console.warn("IDENTITY_PROVIDER=fake: Supabase accounts and avatar files are not touched");
  identity = new FakeIdentityProvider();
  avatars = new FakeAvatarStorage(`http://localhost:${config.port}`);
}

const users = new PrismaUserStore(database);
const now = () => new Date();

const outboxRelay = startOutboxRelay({ database, publisher: await createEventPublisher(broker.channel) });

// A deleted user can still sign in to Supabase until this has run, but Auth's /verify already rejects them.
const PURGE_INTERVAL_MS = 5000;
const accountPurger = startPolling(
  "Account purger",
  async () => {
    const purged = await purgeDeletedAccounts({ users, identity, avatars, now });
    if (purged) console.log(`Removed the Supabase account of ${purged} deleted user(s)`);
  },
  PURGE_INTERVAL_MS,
);

const app = createApp({
  isBrokerConnected: broker.isOpen,
  isDatabaseReachable: () => isDatabaseReachable(database),
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
  internalJwtSecret: config.internalJwtSecret,
  supabaseWebhookSecret: config.supabaseWebhookSecret,
});
const server = app.listen(config.port, () => {
  console.log(`users listening on port ${config.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await accountPurger.stop();
  await outboxRelay.stop();
  await broker.close();
  await database.$disconnect();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
