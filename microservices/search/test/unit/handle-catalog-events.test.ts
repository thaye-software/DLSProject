import { describe, expect, it, vi } from "vitest";
import {
  onAvailabilityChanged,
  onBrandUpdated,
  onProductDeleted,
  onProductSnapshot,
  type CatalogEventDependencies,
} from "../../src/application/handle-catalog-events.js";
import type { ListingStore } from "../../src/application/ports/listing-store.js";
import { listing, PRODUCT_ID } from "../fixtures/products.js";

const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";
const NOW = new Date("2026-10-14T10:05:00Z");

function dependencies(seen = false) {
  const store = {
    upsert: vi.fn<ListingStore["upsert"]>(async () => "written"),
    markDeleted: vi.fn<ListingStore["markDeleted"]>(async () => "written"),
    setAvailability: vi.fn<ListingStore["setAvailability"]>(async () => "written"),
    updateBrand: vi.fn<ListingStore["updateBrand"]>(async () => ({ result: "written", listings: 2 })),
    search: vi.fn<ListingStore["search"]>(),
  };
  const calls: string[] = [];
  const inbox = {
    has: vi.fn(async () => {
      calls.push("has");
      return seen;
    }),
    record: vi.fn(async () => {
      calls.push("record");
    }),
  };
  const cache = {
    generation: vi.fn(async () => 0),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    bump: vi.fn(async () => {
      calls.push("bump");
    }),
  };
  return { store, inbox, cache, calls, all: { store, inbox, cache } satisfies CatalogEventDependencies };
}

describe("hidden products", () => {
  it("are not indexed: a hidden snapshot leaves a tombstone instead of a listing", async () => {
    const d = dependencies();

    const outcome = await onProductSnapshot(EVENT_ID, "product_updated", listing({ availability: "hidden", version: 5 }), d.all);

    expect(outcome.kind).toBe("applied");
    expect(d.store.upsert).not.toHaveBeenCalled();
    expect(d.store.markDeleted).toHaveBeenCalledWith(PRODUCT_ID, 5);
    expect(d.cache.bump).toHaveBeenCalled();
  });

  it("are removed when availability changes to hidden", async () => {
    const d = dependencies();

    await onAvailabilityChanged(EVENT_ID, PRODUCT_ID, 6, "hidden", NOW, d.all);

    expect(d.store.setAvailability).not.toHaveBeenCalled();
    expect(d.store.markDeleted).toHaveBeenCalledWith(PRODUCT_ID, 6);
  });
});

describe("every catalog event", () => {
  it("is skipped when its id was handled before: no change, no cache bump", async () => {
    const d = dependencies(true);

    await expect(onProductSnapshot(EVENT_ID, "product_created", listing(), d.all)).resolves.toEqual({ kind: "duplicate" });
    expect(d.store.upsert).not.toHaveBeenCalled();
    expect(d.cache.bump).not.toHaveBeenCalled();
    expect(d.inbox.record).not.toHaveBeenCalled();
  });

  it("checks the inbox first, changes the index, drops the cached results, and records the id last", async () => {
    const d = dependencies();

    await onProductSnapshot(EVENT_ID, "product_created", listing(), d.all);

    expect(d.calls).toEqual(["has", "bump", "record"]);
    expect(d.inbox.record).toHaveBeenCalledWith(EVENT_ID, "product_created");
  });

  it("does not record the id when the change fails, so the retry runs it again", async () => {
    const d = dependencies();
    d.store.upsert.mockRejectedValue(new Error("mongo down"));

    await expect(onProductSnapshot(EVENT_ID, "product_updated", listing(), d.all)).rejects.toThrow("mongo down");
    expect(d.inbox.record).not.toHaveBeenCalled();
    expect(d.cache.bump).not.toHaveBeenCalled();
  });

  it("still handles the event when the cache can't be invalidated", async () => {
    const d = dependencies();
    d.cache.bump.mockRejectedValue(new Error("redis down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(onProductSnapshot(EVENT_ID, "product_created", listing(), d.all)).resolves.toMatchObject({ kind: "applied" });
    expect(d.inbox.record).toHaveBeenCalled();
  });

  it.each(["stale", "unknown"] as const)("records but leaves the cache alone when the change is %s", async (outcome) => {
    const d = dependencies();
    d.store.setAvailability.mockResolvedValue(outcome);

    const result = await onAvailabilityChanged(EVENT_ID, PRODUCT_ID, 4, "reserved", NOW, d.all);

    expect(result).toMatchObject({ kind: outcome });
    expect(d.cache.bump).not.toHaveBeenCalled();
    expect(d.inbox.record).toHaveBeenCalled();
  });
});

describe("handlers", () => {
  it("product_created / product_updated upsert the listing", async () => {
    const d = dependencies();

    await expect(onProductSnapshot(EVENT_ID, "product_updated", listing({ version: 5 }), d.all)).resolves.toMatchObject({ kind: "applied" });
    expect(d.store.upsert).toHaveBeenCalledWith(listing({ version: 5 }));
  });

  it("product_deleted leaves a tombstone with the event's version", async () => {
    const d = dependencies();

    await onProductDeleted(EVENT_ID, PRODUCT_ID, 7, d.all);

    expect(d.store.markDeleted).toHaveBeenCalledWith(PRODUCT_ID, 7);
  });

  it("product_availability_changed passes version, availability and time on, and says when the product is unknown", async () => {
    const d = dependencies();
    d.store.setAvailability.mockResolvedValue("unknown");

    const result = await onAvailabilityChanged(EVENT_ID, PRODUCT_ID, 4, "sold", NOW, d.all);

    expect(d.store.setAvailability).toHaveBeenCalledWith(PRODUCT_ID, 4, "sold", NOW);
    expect(result).toMatchObject({ kind: "unknown", note: expect.stringContaining("no listing yet") });
  });

  it("brand_updated renames the brand and reports how many listings changed", async () => {
    const d = dependencies();
    const brand = { brandId: "5e0c7a1b-3f2d-4c6e-9b8a-1d2e3f4a5b6c", name: "Rolex SA", slug: "rolex-sa", version: 2 };

    const result = await onBrandUpdated(EVENT_ID, brand, d.all);

    expect(d.store.updateBrand).toHaveBeenCalledWith(brand);
    expect(result).toMatchObject({ kind: "applied", note: expect.stringContaining("2 listing(s)") });
  });
});
