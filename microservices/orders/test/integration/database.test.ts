import { execFileSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, isDatabaseReachable, type Database } from "../../src/adapters/db/prisma.js";

let container: StartedPostgreSqlContainer;
let database: Database;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const url = container.getConnectionUri();
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  database = createDatabase(url);
});

afterAll(async () => {
  await database?.$disconnect();
  await container?.stop();
});

function order(status: string) {
  return {
    userId: "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11",
    status,
    shippingPriceDkk: 30_000n,
    subTotalDkk: 11_500_000n,
    totalPriceDkk: 11_530_000n,
    customerEmail: "mette@example.com",
  };
}

describe("orders database", () => {
  it("is reachable after the migrations ran", async () => {
    expect(await isDatabaseReachable(database)).toBe(true);
  });

  it("stores an order with its items in one write", async () => {
    const created = await database.order.create({
      data: {
        ...order("RESERVED"),
        items: {
          create: [
            {
              productId: "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55",
              quantity: 1,
              productName: "Rolex Submariner Date 126610LN",
              unitPriceDkk: 11_500_000n,
            },
          ],
        },
      },
      include: { items: true },
    });

    expect(created.items).toHaveLength(1);
    expect(created.totalPriceDkk).toBe(11_530_000n);
  });

  it("rejects a status outside OrderStatus (orders_status_check)", async () => {
    await expect(database.order.create({ data: order("SHIPPING") })).rejects.toThrow(/orders_status_check/);
  });

  it("rejects a second order with the same user and idempotency key", async () => {
    const key = "1f0e2d3c-4b5a-4968-8776-655443322110";
    await database.order.create({ data: { ...order("RESERVED"), idempotencyKey: key } });

    await expect(database.order.create({ data: { ...order("RESERVED"), idempotencyKey: key } })).rejects.toThrow();
  });
});
