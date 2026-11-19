import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Broker } from "../support/broker.js";
import { seedProduct, type SeededProduct } from "../support/catalog.js";
import { signUp } from "../support/customers.js";
import { publicCall } from "../support/gateway.js";
import { placeOrder } from "../support/orders.js";

let broker: Broker;

beforeAll(async () => {
  broker = await Broker.connect();
});

afterAll(async () => {
  await broker.close();
});

// Catalog has no product admin yet, so nothing publishes product_created; the test publishes the snapshot
// Catalog will publish once it does, and Catalog's own product_availability_changed does the rest.
async function listInSearch(watch: SeededProduct): Promise<void> {
  await broker.publish("catalog.events", "/services/catalog", "product_created", watch.productId, {
    product: {
      product_id: watch.productId,
      version: 1,
      name: watch.name,
      price: { amount_minor: watch.priceMinor, currency: "DKK" },
      availability: "available",
      watch: {
        slug: watch.slug,
        brand: { brand_id: "5e0c7a1b-3f2d-4c6e-9b8a-1d2e3f4a5b6c", name: "Omega", slug: "omega" },
        model: "Speedmaster",
        reference: "310.30.42.50.01.001",
        year: 2024,
        condition: 1,
        size_mm: 42,
        limited: false,
      },
      images: [],
      updated_at: new Date().toISOString(),
    },
  });
}

async function searchFor(name: string, availability: string[]): Promise<{ product_id: string; availability: string }[]> {
  const query = new URLSearchParams([["q", name], ...availability.map((value) => ["availability", value])]);
  const response = await publicCall("search", "GET", `/search?${query}`);
  expect(response.status).toBe(200);
  return response.body.items;
}

describe("search read model (Catalog → Search)", () => {
  it("follows a watch from available to reserved and back as an order is placed and cancelled", async () => {
    const watch = await seedProduct();
    await listInSearch(watch);
    await vi.waitFor(async () => expect(await searchFor(watch.name, ["available"])).toEqual([expect.objectContaining({ product_id: watch.productId, availability: "available" })]), {
      timeout: 20_000,
      interval: 250,
    });

    const customer = await signUp();
    const order = await placeOrder(customer, [watch.productId]);

    await vi.waitFor(async () => expect(await searchFor(watch.name, ["reserved"])).toEqual([expect.objectContaining({ product_id: watch.productId, availability: "reserved" })]), {
      timeout: 20_000,
      interval: 250,
    });
    expect(await searchFor(watch.name, ["available"])).toEqual([]);

    await customer.api.call("orders", "POST", `/orders/${order.order_id}/cancel`);

    await vi.waitFor(async () => expect(await searchFor(watch.name, ["available"])).toEqual([expect.objectContaining({ product_id: watch.productId, availability: "available" })]), {
      timeout: 20_000,
      interval: 250,
    });
  });

  it("rejects hidden as a search filter with 422", async () => {
    const response = await publicCall("search", "GET", "/search?availability=hidden");

    expect(response.status).toBe(422);
    expect(response.body.type).toBe("https://limitedwatches.dk/problems/validation_error");
  });
});
