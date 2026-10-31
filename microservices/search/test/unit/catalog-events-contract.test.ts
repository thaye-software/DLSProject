import { describe, expect, it } from "vitest";
import {
  brandUpdatedSchema,
  productAvailabilityChangedSchema,
  productDeletedSchema,
  productSnapshotEventSchema,
} from "../../src/adapters/rabbitmq/catalog-events.js";
import { toListing } from "../../src/domain/snapshot.js";
import { asyncApi } from "../support/contract.js";

const example = (message: string) => asyncApi.components.messages[message].examples[0].payload.data;

describe("catalog.events contract", () => {
  it.each([
    { message: "ProductCreated", schema: productSnapshotEventSchema },
    { message: "ProductUpdated", schema: productSnapshotEventSchema },
    { message: "ProductDeleted", schema: productDeletedSchema },
    { message: "ProductAvailabilityChanged", schema: productAvailabilityChangedSchema },
    { message: "BrandUpdated", schema: brandUpdatedSchema },
  ])("Search accepts the contract's example $message", ({ message, schema }) => {
    const result = schema.safeParse(example(message));

    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("turns the contract's example product into a complete listing", () => {
    const { product } = productSnapshotEventSchema.parse(example("ProductCreated"));

    const listing = toListing(product);

    expect(listing.productId).toBe(product.product_id);
    expect(listing.priceDkk).toBe(product.price.amount_minor);
    expect(listing.slug.length).toBeGreaterThan(0);
  });

  it.each([
    { name: "a price in EUR", mutate: (d: any) => ({ product: { ...d.product, price: { amount_minor: 1, currency: "EUR" } } }) },
    { name: "an availability that doesn't exist", mutate: (d: any) => ({ product: { ...d.product, availability: "lost" } }) },
    { name: "a version of 0", mutate: (d: any) => ({ product: { ...d.product, version: 0 } }) },
    { name: "no product", mutate: () => ({}) },
  ])("rejects a product event with $name", ({ mutate }) => {
    expect(productSnapshotEventSchema.safeParse(mutate(example("ProductCreated"))).success).toBe(false);
  });
});
