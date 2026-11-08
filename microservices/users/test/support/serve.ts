import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach } from "vitest";
import { createApp, type AppDependencies } from "../../src/adapters/http/app.js";

export const INTERNAL_JWT_SECRET = "gateway-and-users-share-this-32-char-secret";
export const WEBHOOK_SECRET = "supabase-webhook-secret-of-32-characters!";

const defaultDependencies: AppDependencies = {
  isBrokerConnected: () => true,
  isDatabaseReachable: async () => true,
  createUser: async () => {
    throw new Error("createUser not stubbed");
  },
  isUsernameTaken: async () => false,
  getProfile: async () => null,
  updateProfile: async () => ({ kind: "not_found" }),
  setAddress: async () => null,
  removeAddress: async () => null,
  uploadAvatar: async () => ({ kind: "not_found" }),
  deleteAccount: async () => "not_found",
  getUser: async () => null,
  syncConfirmedEmail: async () => "not_found",
  internalJwtSecret: INTERNAL_JWT_SECRET,
  supabaseWebhookSecret: WEBHOOK_SECRET,
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
