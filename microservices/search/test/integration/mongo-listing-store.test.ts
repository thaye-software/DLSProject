import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoListingStore } from "../../src/adapters/mongo/mongo-listing-store.js";
import type { SearchQuery } from "../../src/domain/listing.js";
import { BRAND_ID, listing, OTHER_BRAND_ID, OTHER_PRODUCT_ID, PRODUCT_ID } from "../fixtures/products.js";
import { startMongo, type TestMongo } from "../support/containers.js";

let test: TestMongo;
let store: MongoListingStore;

beforeAll(async () => {
  test = await startMongo();
  store = new MongoListingStore(test.mongo.db);
  await store.ensureIndexes();
});

beforeEach(async () => {
  await test.mongo.db.collection("product_listings").deleteMany({});
  await test.mongo.db.collection("brands").deleteMany({});
});

afterAll(async () => {
  await test.mongo?.close();
  await test.container?.stop();
});

const query = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  q: null,
  brand: null,
  availability: ["available"],
  minPriceDkk: null,
  maxPriceDkk: null,
  page: 1,
  pageSize: 20,
  ...overrides,
});

const ids = async (overrides: Partial<SearchQuery> = {}) => (await store.search(query(overrides))).items.map((item) => item.productId);

describe("MongoListingStore version rules", () => {
  it("creates a listing and finds it again with every field", async () => {
    await expect(store.upsert(listing())).resolves.toBe("written");

    await expect(store.search(query())).resolves.toEqual({ items: [listing()], total: 1 });
  });

  it("replaces a listing only with a newer version", async () => {
    await store.upsert(listing({ version: 3, priceDkk: 100 }));

    await expect(store.upsert(listing({ version: 4, priceDkk: 200 }))).resolves.toBe("written");
    await expect(store.upsert(listing({ version: 4, priceDkk: 999 }))).resolves.toBe("stale");
    await expect(store.upsert(listing({ version: 2, priceDkk: 999 }))).resolves.toBe("stale");

    expect((await store.search(query())).items[0]).toMatchObject({ version: 4, priceDkk: 200 });
  });

  it("deletes through a tombstone that keeps an older reordered update from bringing the listing back", async () => {
    await store.upsert(listing({ version: 3 }));

    await expect(store.markDeleted(PRODUCT_ID, 4)).resolves.toBe("written");
    await expect(store.upsert(listing({ version: 3 }))).resolves.toBe("stale");
    await expect(store.upsert(listing({ version: 4 }))).resolves.toBe("stale");

    expect((await store.search(query())).total).toBe(0);
  });

  it("lets a newer version create the product again after a delete", async () => {
    await store.upsert(listing({ version: 3 }));
    await store.markDeleted(PRODUCT_ID, 4);

    await expect(store.upsert(listing({ version: 5 }))).resolves.toBe("written");

    expect(await ids()).toEqual([PRODUCT_ID]);
  });

  it("ignores a delete older than the stored version, and records a delete for a product it never saw", async () => {
    await store.upsert(listing({ version: 5 }));

    await expect(store.markDeleted(PRODUCT_ID, 4)).resolves.toBe("stale");
    await expect(store.markDeleted(OTHER_PRODUCT_ID, 2)).resolves.toBe("written");
    await expect(store.upsert(listing({ productId: OTHER_PRODUCT_ID, version: 1 }))).resolves.toBe("stale");
    expect(await ids()).toEqual([PRODUCT_ID]);
  });
});

describe("MongoListingStore concurrent writes", () => {
  const ROUNDS = 25;
  const versionOf = async (productId: string) => (await test.mongo.db.collection("product_listings").findOne({ _id: productId as never }))?.version;

  // Two events for a product that isn't stored yet both miss the version filter and race to insert; the loser gets a
  // duplicate key error even when it is the newer one. Many rounds, because the race is a matter of timing.
  it("ends on the newest version when two versions of a new product arrive at once", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const productId = randomUUID();

      await Promise.all([store.upsert(listing({ productId, version: 1 })), store.upsert(listing({ productId, version: 2 }))]);

      expect(await versionOf(productId), `round ${round}`).toBe(2);
    }
  });

  it("ends on the newest version when several versions arrive in any order at once", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const productId = randomUUID();
      const versions = [3, 1, 5, 2, 4];

      await Promise.all(versions.map((version) => store.upsert(listing({ productId, version }))));

      expect(await versionOf(productId), `round ${round}`).toBe(5);
    }
  });

  it("ends deleted when a delete races the creation of the product", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const productId = randomUUID();

      await Promise.all([store.upsert(listing({ productId, version: 1 })), store.markDeleted(productId, 2)]);

      expect(await test.mongo.db.collection("product_listings").findOne({ _id: productId as never })).toEqual({ _id: productId, version: 2, deleted: true });
    }
  });

  it("ends on the newest brand version when two brand_updated events for a new brand arrive at once", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const brandId = randomUUID();

      await Promise.all([
        store.updateBrand({ brandId, name: "Old", slug: "old", version: 1 }),
        store.updateBrand({ brandId, name: "New", slug: "new", version: 2 }),
      ]);

      expect(await test.mongo.db.collection("brands").findOne({ _id: brandId as never }), `round ${round}`).toEqual({ _id: brandId, name: "New", slug: "new", version: 2 });
    }
  });
});

describe("MongoListingStore.setAvailability", () => {
  const at = new Date("2026-10-15T09:00:00Z");

  it("changes the availability and takes the event's version", async () => {
    await store.upsert(listing({ version: 3 }));

    await expect(store.setAvailability(PRODUCT_ID, 4, "reserved", at)).resolves.toBe("written");

    expect(await ids({ availability: ["available"] })).toEqual([]);
    expect((await store.search(query({ availability: ["reserved"] }))).items[0]).toMatchObject({ version: 4, availability: "reserved", updatedAt: at });
  });

  it("reports unknown for a product with no listing, and stores nothing", async () => {
    await expect(store.setAvailability(PRODUCT_ID, 2, "reserved", at)).resolves.toBe("unknown");

    expect((await store.search(query({ availability: ["available", "reserved", "sold"] }))).total).toBe(0);
  });

  it.each([
    { name: "an equal version", version: 3 },
    { name: "an older version", version: 2 },
  ])("reports stale for $name", async ({ version }) => {
    await store.upsert(listing({ version: 3 }));

    await expect(store.setAvailability(PRODUCT_ID, version, "sold", at)).resolves.toBe("stale");
    expect(await ids()).toEqual([PRODUCT_ID]);
  });

  it("reports stale for a deleted product", async () => {
    await store.upsert(listing({ version: 3 }));
    await store.markDeleted(PRODUCT_ID, 4);

    await expect(store.setAvailability(PRODUCT_ID, 9, "available", at)).resolves.toBe("stale");
  });
});

describe("MongoListingStore brands", () => {
  it("renames the brand on all its listings, and only those", async () => {
    await store.upsert(listing());
    await store.upsert(listing({ productId: OTHER_PRODUCT_ID, brandId: OTHER_BRAND_ID, brandName: "Omega", brandSlug: "omega" }));

    await expect(store.updateBrand({ brandId: BRAND_ID, name: "Rolex SA", slug: "rolex-sa", version: 2 })).resolves.toEqual({ result: "written", listings: 1 });

    const found = (await store.search(query())).items;
    expect(found.find((item) => item.productId === PRODUCT_ID)).toMatchObject({ brandName: "Rolex SA", brandSlug: "rolex-sa" });
    expect(found.find((item) => item.productId === OTHER_PRODUCT_ID)).toMatchObject({ brandName: "Omega", brandSlug: "omega" });
    expect(await ids({ brand: "rolex-sa" })).toEqual([PRODUCT_ID]);
  });

  it("ignores an equal or older brand version", async () => {
    await store.updateBrand({ brandId: BRAND_ID, name: "Rolex SA", slug: "rolex-sa", version: 3 });
    await store.upsert(listing());

    await expect(store.updateBrand({ brandId: BRAND_ID, name: "Old Name", slug: "old", version: 3 })).resolves.toEqual({ result: "stale", listings: 0 });
    await expect(store.updateBrand({ brandId: BRAND_ID, name: "Older", slug: "older", version: 1 })).resolves.toEqual({ result: "stale", listings: 0 });
  });

  it("writes a product snapshot built before a rename with the newer brand name", async () => {
    await store.updateBrand({ brandId: BRAND_ID, name: "Rolex SA", slug: "rolex-sa", version: 2 });

    await store.upsert(listing({ brandName: "Rolex", brandSlug: "rolex" }));

    expect((await store.search(query())).items[0]).toMatchObject({ brandName: "Rolex SA", brandSlug: "rolex-sa" });
  });

  it("does not touch a deleted product's tombstone", async () => {
    await store.upsert(listing());
    await store.markDeleted(PRODUCT_ID, 4);

    await store.updateBrand({ brandId: BRAND_ID, name: "Rolex SA", slug: "rolex-sa", version: 2 });

    expect(await test.mongo.db.collection("product_listings").findOne({ _id: PRODUCT_ID as never })).toEqual({ _id: PRODUCT_ID, version: 4, deleted: true });
  });
});

describe("MongoListingStore.search", () => {
  const submariner = listing({ updatedAt: new Date("2026-10-10T00:00:00Z") });
  const daytona = listing({ productId: "11111111-1111-4111-8111-111111111111", name: "Rolex Daytona", reference: "116500LN", priceDkk: 20_000_000, updatedAt: new Date("2026-10-11T00:00:00Z") });
  const speedmaster = listing({ productId: "22222222-2222-4222-8222-222222222222", name: "Omega Speedmaster Moonwatch", brandId: OTHER_BRAND_ID, brandName: "Omega", brandSlug: "omega", reference: "310.30.42.50.01.001", priceDkk: 5_000_000, updatedAt: new Date("2026-10-12T00:00:00Z") });
  const sold = listing({ productId: "33333333-3333-4333-8333-333333333333", name: "Rolex GMT-Master II", reference: "126710BLRO", availability: "sold", priceDkk: 9_000_000, updatedAt: new Date("2026-10-13T00:00:00Z") });
  const hidden = listing({ productId: "44444444-4444-4444-8444-444444444444", name: "Rolex Hidden", reference: "HIDDEN1", availability: "hidden", updatedAt: new Date("2026-10-14T00:00:00Z") });
  const strap = listing({ productId: "55555555-5555-4555-8555-555555555555", name: "Leather Strap", brandId: null, brandName: null, brandSlug: null, model: null, reference: null, year: null, sizeMm: null, condition: null, limited: null, priceDkk: 50_000, updatedAt: new Date("2026-10-09T00:00:00Z") });

  beforeEach(async () => {
    for (const item of [submariner, daytona, speedmaster, sold, hidden, strap]) await store.upsert(item);
  });

  it("returns only available listings by default, newest first when there is no q", async () => {
    expect(await ids()).toEqual([speedmaster.productId, daytona.productId, submariner.productId, strap.productId]);
  });

  it("never returns hidden products", async () => {
    const all = await ids({ availability: ["available", "reserved", "sold"] });

    expect(all).not.toContain(hidden.productId);
    expect(all).toContain(sold.productId);
  });

  it("brings a product back when a newer snapshot makes it visible again", async () => {
    await store.markDeleted(hidden.productId, hidden.version + 1);
    expect(await ids({ q: "HIDDEN1" })).toEqual([]);

    await store.upsert({ ...hidden, version: hidden.version + 2, availability: "available" });
    expect(await ids({ q: "HIDDEN1" })).toEqual([hidden.productId]);
  });

  it("filters on availability, brand slug and a price range in øre (inclusive)", async () => {
    expect(await ids({ availability: ["sold"] })).toEqual([sold.productId]);
    expect(await ids({ brand: "omega" })).toEqual([speedmaster.productId]);
    expect(await ids({ minPriceDkk: 5_000_000, maxPriceDkk: 11_500_000 })).toEqual([speedmaster.productId, submariner.productId]);
    expect(await ids({ minPriceDkk: 11_500_001 })).toEqual([daytona.productId]);
    expect(await ids({ maxPriceDkk: 49_999 })).toEqual([]);
  });

  it("matches q against name, brand name and reference, case-insensitive, as part of a word", async () => {
    expect(await ids({ q: "SPEEDMASTER" })).toEqual([speedmaster.productId]);
    expect(await ids({ q: "omega" })).toEqual([speedmaster.productId]);
    expect(await ids({ q: "1266" })).toEqual([submariner.productId]);
    expect(await ids({ q: "116500" })).toEqual([daytona.productId]);
  });

  it("needs every word of q to match, in any order", async () => {
    expect(await ids({ q: "rolex daytona" })).toEqual([daytona.productId]);
    expect(await ids({ q: "daytona rolex" })).toEqual([daytona.productId]);
    expect(await ids({ q: "rolex omega" })).toEqual([]);
  });

  it("treats regex characters in q as plain text", async () => {
    expect(await ids({ q: ".*" })).toEqual([]);
    expect(await ids({ q: "(" })).toEqual([]);
    expect((await store.search(query({ q: "310.30" }))).items.map((item) => item.productId)).toEqual([speedmaster.productId]);
  });

  it("ranks an exact reference above a name that starts with q, above any other match", async () => {
    const exact = listing({ productId: "66666666-6666-4666-8666-666666666666", name: "Something else", brandId: null, brandName: null, brandSlug: null, reference: "daytona" });

    await store.upsert(exact);

    expect(await ids({ q: "daytona" })).toEqual([exact.productId, daytona.productId]);
    expect(await ids({ q: "rolex" })).toEqual([daytona.productId, submariner.productId]);
  });

  it("pages without overlap or gaps, with the total for the whole result", async () => {
    const pages = await Promise.all([1, 2, 3].map((page) => store.search(query({ page, pageSize: 2 }))));

    expect(pages.map((page) => page.items.length)).toEqual([2, 2, 0]);
    expect(pages.every((page) => page.total === 4)).toBe(true);
    expect(pages.flatMap((page) => page.items.map((item) => item.productId))).toEqual(await ids());
  });
});
