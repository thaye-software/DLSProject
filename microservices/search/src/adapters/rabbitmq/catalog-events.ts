import { z } from "zod";
import {
  onAvailabilityChanged,
  onBrandUpdated,
  onProductDeleted,
  onProductSnapshot,
  type CatalogEventDependencies,
  type Outcome,
} from "../../application/handle-catalog-events.js";
import { AVAILABILITIES } from "../../domain/listing.js";
import { toListing, type ProductSnapshot } from "../../domain/snapshot.js";
import { handleEvent, type EventHandler } from "./consumer.js";

export const CATALOG_EVENTS_EXCHANGE = "catalog.events";
export const CATALOG_EVENTS_QUEUE = "search.catalog.events";

// Only the fields Search uses; consumers ignore unknown fields (docs/contracts/README.md §1).
const availabilitySchema = z.enum(AVAILABILITIES);
const brandSchema = z.object({ brand_id: z.uuid(), name: z.string(), slug: z.string() });

const productSnapshotSchema = z.object({
  product_id: z.uuid(),
  version: z.number().int().min(1),
  name: z.string(),
  price: z.object({ amount_minor: z.number().int().min(0), currency: z.literal("DKK") }),
  availability: availabilitySchema,
  watch: z
    .object({
      slug: z.string(),
      brand: brandSchema,
      model: z.string(),
      reference: z.string(),
      year: z.number().int(),
      condition: z.number().int(),
      size_mm: z.number().int().nullable(),
      limited: z.boolean(),
    })
    .nullable(),
  images: z.array(z.object({ url: z.string(), is_thumbnail: z.boolean() })),
  updated_at: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<ProductSnapshot>;

export const productSnapshotEventSchema = z.object({ product: productSnapshotSchema });
export const productDeletedSchema = z.object({ product_id: z.uuid(), version: z.number().int().min(1) });
export const productAvailabilityChangedSchema = z.object({
  product_id: z.uuid(),
  version: z.number().int().min(1),
  availability: availabilitySchema,
  changed_at: z.iso.datetime({ offset: true }),
});
export const brandUpdatedSchema = z.object({ brand: brandSchema, version: z.number().int().min(1) });

function log(type: string, eventId: string, outcome: Outcome): void {
  const text = outcome.kind === "duplicate" ? "already handled, skipped" : outcome.note;
  console.log(`${type} ${eventId}: ${text}`);
}

export function createCatalogEventHandlers(dependencies: CatalogEventDependencies): Record<string, EventHandler> {
  const snapshotHandler = (type: "product_created" | "product_updated") =>
    handleEvent(productSnapshotEventSchema, async ({ product }, event) => {
      log(type, event.id, await onProductSnapshot(event.id, type, toListing(product), dependencies));
    });

  return {
    product_created: snapshotHandler("product_created"),
    product_updated: snapshotHandler("product_updated"),
    product_deleted: handleEvent(productDeletedSchema, async (data, event) => {
      log(event.type, event.id, await onProductDeleted(event.id, data.product_id, data.version, dependencies));
    }),
    product_availability_changed: handleEvent(productAvailabilityChangedSchema, async (data, event) => {
      const outcome = await onAvailabilityChanged(event.id, data.product_id, data.version, data.availability, new Date(data.changed_at), dependencies);
      log(event.type, event.id, outcome);
    }),
    brand_updated: handleEvent(brandUpdatedSchema, async ({ brand, version }, event) => {
      const updated = { brandId: brand.brand_id, name: brand.name, slug: brand.slug, version };
      log(event.type, event.id, await onBrandUpdated(event.id, updated, dependencies));
    }),
  };
}
