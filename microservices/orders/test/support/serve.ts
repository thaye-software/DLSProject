import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach } from "vitest";
import { createApp, type AppDependencies } from "../../src/adapters/http/app.js";

export const INTERNAL_JWT_SECRET = "orders-and-payment-share-this-32-char-secret";

const defaultDependencies: AppDependencies = {
  isBrokerConnected: () => true,
  isDatabaseReachable: async () => true,
  createOrder: async () => {
    throw new Error("createOrder not stubbed");
  },
  getOrder: async () => null,
  listOrders: async () => ({ orders: [], total: 0 }),
  getPaymentDetails: async () => ({ outcome: "not_found" }),
  internalJwtSecret: INTERNAL_JWT_SECRET,
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
