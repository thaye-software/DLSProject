import { describe, expect, it } from "vitest";
import { slugify, thumbnailOf, toListing } from "../../src/domain/snapshot.js";
import { listing, snapshot } from "../fixtures/products.js";

describe("toListing", () => {
  it("maps a watch snapshot to a listing, in øre, with the thumbnail image", () => {
    expect(toListing(snapshot)).toEqual(listing());
  });

  it("maps a product without a watch: no brand or watch fields, slug from the name", () => {
    const result = toListing({ ...snapshot, name: "Leather Strap (Brown)", watch: null });

    expect(result).toMatchObject({
      slug: "leather-strap-brown",
      brandId: null,
      brandName: null,
      brandSlug: null,
      model: null,
      reference: null,
      year: null,
      sizeMm: null,
      condition: null,
      limited: null,
    });
  });

  it("keeps a null size", () => {
    expect(toListing({ ...snapshot, watch: { ...snapshot.watch!, size_mm: null } }).sizeMm).toBeNull();
  });
});

describe("thumbnailOf", () => {
  const images = [
    { url: "a", is_thumbnail: false },
    { url: "b", is_thumbnail: true },
    { url: "c", is_thumbnail: true },
  ];

  it.each([
    { name: "the first thumbnail", images, expected: "b" },
    { name: "the first image when none is a thumbnail", images: [{ url: "a", is_thumbnail: false }, { url: "d", is_thumbnail: false }], expected: "a" },
    { name: "null without images", images: [], expected: null },
  ])("returns $name", ({ images: list, expected }) => {
    expect(thumbnailOf(list)).toBe(expected);
  });
});

describe("slugify", () => {
  it.each([
    { name: "Rolex Submariner Date", slug: "rolex-submariner-date" },
    { name: "  Ørsted & Søn — 42mm  ", slug: "orsted-son-42mm" },
    { name: "Blå Æble Åre", slug: "bla-aeble-are" },
    { name: "Café Racer", slug: "cafe-racer" },
    { name: "!!!", slug: "product" },
  ])("turns $name into $slug", ({ name, slug }) => {
    expect(slugify(name)).toBe(slug);
  });
});
