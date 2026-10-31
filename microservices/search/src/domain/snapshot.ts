import type { Availability, Listing } from "./listing.js";

// The ProductSnapshot of docs/contracts/asyncapi.yaml, as far as Search uses it.
export type ProductSnapshot = {
  product_id: string;
  version: number;
  name: string;
  price: { amount_minor: number; currency: "DKK" };
  availability: Availability;
  watch: {
    slug: string;
    brand: { brand_id: string; name: string; slug: string };
    model: string;
    reference: string;
    year: number;
    condition: number;
    size_mm: number | null;
    limited: boolean;
  } | null;
  images: { url: string; is_thumbnail: boolean }[];
  updated_at: string;
};

// shortcut: slug exists only on WatchDetails, but ProductListing.slug is required; a product without a watch gets
// its name slugified. Replace once Catalog says what the slug of a non-watch product is (see DECISIONS.md).
export function slugify(name: string): string {
  const slug = name
    // æ and ø don't decompose into plain letters like å does.
    .replace(/æ/gi, "ae")
    .replace(/ø/gi, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "product";
}

export function thumbnailOf(images: ProductSnapshot["images"]): string | null {
  return (images.find((image) => image.is_thumbnail) ?? images[0])?.url ?? null;
}

export function toListing(snapshot: ProductSnapshot): Listing {
  const { watch } = snapshot;
  return {
    productId: snapshot.product_id,
    version: snapshot.version,
    name: snapshot.name,
    slug: watch?.slug ?? slugify(snapshot.name),
    brandId: watch?.brand.brand_id ?? null,
    brandName: watch?.brand.name ?? null,
    brandSlug: watch?.brand.slug ?? null,
    model: watch?.model ?? null,
    reference: watch?.reference ?? null,
    year: watch?.year ?? null,
    sizeMm: watch?.size_mm ?? null,
    condition: watch?.condition ?? null,
    limited: watch?.limited ?? null,
    priceDkk: snapshot.price.amount_minor,
    availability: snapshot.availability,
    thumbnailUrl: thumbnailOf(snapshot.images),
    updatedAt: new Date(snapshot.updated_at),
  };
}
