import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach } from "vitest";
import { createApp, type AppDependencies } from "../../src/adapters/http/app.js";
import { conversation, message } from "../fixtures/chat.js";

const defaultDependencies: AppDependencies = {
  isBrokerConnected: () => true,
  isDatabaseReachable: async () => true,
  openConversation: async () => ({ outcome: "created", conversation: conversation() }),
  listConversations: async () => [],
  listMessages: async () => ({ outcome: "ok", page: { items: [], nextCursor: null } }),
  sendMessage: async () => ({ outcome: "sent", message: message() }),
  markRead: async () => ({ outcome: "read" }),
};

let server: Server | undefined;

afterEach(async () => {
  const running = server;
  server = undefined;
  if (running) await new Promise((resolve) => running.close(resolve));
});

export async function serve(dependencies: Partial<AppDependencies> = {}): Promise<string> {
  server = createApp({ ...defaultDependencies, ...dependencies }).listen(0);
  await new Promise((resolve) => server!.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}
