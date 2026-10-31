import { MongoServerError, type Collection, type Db, type Filter, type WithoutId } from "mongodb";
import type { AvailabilityResult, ListingStore, WriteResult } from "../../application/ports/listing-store.js";
import type { Availability, Brand, Listing, SearchQuery, SearchResult } from "../../domain/listing.js";

// A document of product_listings. A deleted product keeps only { _id, version, deleted: true }.
export type ListingDoc = {
  _id: string;
  version: number;
  deleted?: true;
  name?: string;
  slug?: string;
  brand_id?: string | null;
  brand_name?: string | null;
  brand_slug?: string | null;
  model?: string | null;
  reference?: string | null;
  year?: number | null;
  size_mm?: number | null;
  condition?: number | null;
  limited?: boolean | null;
  price_dkk?: number;
  availability?: Availability;
  thumbnail_url?: string | null;
  updated_at?: Date;
};

type BrandDoc = { _id: string; name: string; slug: string; version: number };

const DUPLICATE_KEY = 11000;

export class MongoListingStore implements ListingStore {
  private readonly listings: Collection<ListingDoc>;
  private readonly brands: Collection<BrandDoc>;

  constructor(db: Db) {
    this.listings = db.collection<ListingDoc>("product_listings");
    this.brands = db.collection<BrandDoc>("brands");
  }

  async ensureIndexes(): Promise<void> {
    await this.listings.createIndexes([
      { key: { availability: 1, price_dkk: 1 }, name: "availability_price" },
      { key: { brand_slug: 1 }, name: "brand_slug" },
      // brand_updated renames every listing of the brand.
      { key: { brand_id: 1 }, name: "brand_id" },
      { key: { updated_at: -1 }, name: "updated_at" },
    ]);
  }

  async upsert(listing: Listing): Promise<WriteResult> {
    // The brands collection holds the newest brand name and slug seen on brand_updated, so a product snapshot built
    // before a rename can't undo it.
    const brand = listing.brandId ? await this.brands.findOne({ _id: listing.brandId }) : null;
    return this.replaceIfNewer({
      _id: listing.productId,
      version: listing.version,
      name: listing.name,
      slug: listing.slug,
      brand_id: listing.brandId,
      brand_name: brand?.name ?? listing.brandName,
      brand_slug: brand?.slug ?? listing.brandSlug,
      model: listing.model,
      reference: listing.reference,
      year: listing.year,
      size_mm: listing.sizeMm,
      condition: listing.condition,
      limited: listing.limited,
      price_dkk: listing.priceDkk,
      availability: listing.availability,
      thumbnail_url: listing.thumbnailUrl,
      updated_at: listing.updatedAt,
    });
  }

  markDeleted(productId: string, version: number): Promise<WriteResult> {
    return this.replaceIfNewer({ _id: productId, version, deleted: true });
  }

  async setAvailability(productId: string, version: number, availability: Availability, at: Date): Promise<AvailabilityResult> {
    const updated = await this.listings.updateOne(
      { _id: productId, version: { $lt: version }, deleted: { $ne: true } },
      { $set: { availability, version, updated_at: at } },
    );
    if (updated.matchedCount === 1) return "written";
    // Nothing matched: either there is no listing at all, or its version is equal/newer, or it is deleted.
    return (await this.listings.countDocuments({ _id: productId }, { limit: 1 })) === 0 ? "unknown" : "stale";
  }

  async updateBrand(brand: Brand): Promise<{ result: WriteResult; listings: number }> {
    const result = await this.writeIfNewer(this.brands, brand.brandId, brand.version, { name: brand.name, slug: brand.slug, version: brand.version });
    if (result === "stale") return { result, listings: 0 };
    const renamed = await this.listings.updateMany(
      { brand_id: brand.brandId, deleted: { $ne: true } },
      { $set: { brand_name: brand.name, brand_slug: brand.slug } },
    );
    return { result, listings: renamed.modifiedCount };
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const filter = buildFilter(query);
    const total = await this.listings.countDocuments(filter);
    const docs = await this.listings
      .aggregate<ListingDoc>([
        { $match: filter },
        ...(query.q ? [{ $addFields: { _rank: rankExpression(query.q) } }, { $sort: { _rank: -1, updated_at: -1, _id: 1 } }] : [{ $sort: { updated_at: -1, _id: 1 } }]),
        { $skip: (query.page - 1) * query.pageSize },
        { $limit: query.pageSize },
      ])
      .toArray();
    return { items: docs.map(toListing), total };
  }

  private replaceIfNewer(doc: ListingDoc): Promise<WriteResult> {
    const { _id, ...fields } = doc;
    return this.writeIfNewer(this.listings, _id, doc.version, fields);
  }

  // The filter holds the stored version as a condition, so a newer document already in place doesn't match, the
  // upsert then tries to insert the same _id, and Mongo's duplicate key error says a document exists. That alone
  // doesn't make the event stale: two events for a product that isn't stored yet can both miss the filter and race
  // to insert, and the loser may be the newer one. So look at the stored version and, if it is older, go again; the
  // document exists by now, so the filter matches.
  private async writeIfNewer<T extends { _id: string; version: number }>(
    collection: Collection<T>,
    id: string,
    version: number,
    fields: Omit<T, "_id">,
  ): Promise<WriteResult> {
    for (;;) {
      try {
        await collection.replaceOne({ _id: id, version: { $lt: version } } as Filter<T>, fields as WithoutId<T>, { upsert: true });
        return "written";
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const stored = await collection.findOne({ _id: id } as Filter<T>, { projection: { version: 1 } });
        if (stored && stored.version >= version) return "stale";
      }
    }
  }
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A word-by-word match: every word of q must be in the name, the brand name or the reference, in any order,
// case-insensitive, as a part of a word ("1266" finds "126610LN"), like the monolith's search.
function buildFilter({ q, brand, availability, minPriceDkk, maxPriceDkk }: SearchQuery): Filter<ListingDoc> {
  // Tombstones have no availability, so they never match.
  const filter: Filter<ListingDoc> = { availability: { $in: availability } };
  if (brand) filter.brand_slug = brand;
  if (minPriceDkk !== null || maxPriceDkk !== null) {
    filter.price_dkk = { ...(minPriceDkk !== null && { $gte: minPriceDkk }), ...(maxPriceDkk !== null && { $lte: maxPriceDkk }) };
  }
  if (q) {
    filter.$and = q.split(/\s+/).map((word) => {
      const regex = { $regex: escapeRegex(word), $options: "i" };
      return { $or: [{ name: regex }, { brand_name: regex }, { reference: regex }] };
    });
  }
  return filter;
}

// Best match first: the reference is exactly q (3), the name starts with q (2), anything else (1).
function rankExpression(q: string) {
  return {
    $switch: {
      branches: [
        { case: { $eq: [{ $toLower: { $ifNull: ["$reference", ""] } }, q.toLowerCase()] }, then: 3 },
        { case: { $regexMatch: { input: "$name", regex: `^${escapeRegex(q)}`, options: "i" } }, then: 2 },
      ],
      default: 1,
    },
  };
}

function toListing(doc: ListingDoc): Listing {
  // A document that matched the filter is never a tombstone, so the optional fields are all present.
  return {
    productId: doc._id,
    version: doc.version,
    name: doc.name!,
    slug: doc.slug!,
    brandId: doc.brand_id ?? null,
    brandName: doc.brand_name ?? null,
    brandSlug: doc.brand_slug ?? null,
    model: doc.model ?? null,
    reference: doc.reference ?? null,
    year: doc.year ?? null,
    sizeMm: doc.size_mm ?? null,
    condition: doc.condition ?? null,
    limited: doc.limited ?? null,
    priceDkk: doc.price_dkk!,
    availability: doc.availability!,
    thumbnailUrl: doc.thumbnail_url ?? null,
    updatedAt: doc.updated_at!,
  };
}
