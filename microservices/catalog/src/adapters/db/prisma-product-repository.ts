import type { ProductRepository } from "../../application/ports/product-repository.js";
import { AVAILABILITIES, type Availability, type Product } from "../../domain/product.js";
import type { Database } from "./prisma.js";

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  brandName: string | null;
  model: string | null;
  priceDkk: bigint;
  stock: number;
  availability: string;
  thumbnailUrl: string | null;
  version: number;
};

export function productData(product: Product): ProductRow {
  return {
    id: product.productId,
    name: product.name,
    slug: product.slug,
    brandName: product.brandName,
    model: product.model,
    priceDkk: BigInt(product.price.amountMinor),
    stock: product.stock,
    availability: product.availability,
    thumbnailUrl: product.thumbnailUrl,
    version: product.version,
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    productId: row.id,
    name: row.name,
    slug: row.slug,
    brandName: row.brandName,
    model: row.model,
    price: { amountMinor: Number(row.priceDkk), currency: "DKK" },
    availability: availability(row.availability),
    thumbnailUrl: row.thumbnailUrl,
    stock: row.stock,
    version: row.version,
  };
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly database: Database) {}

  async findById(productId: string): Promise<Product | null> {
    const row = await this.database.product.findUnique({ where: { id: productId } });
    return row ? toProduct(row) : null;
  }
}

function availability(value: string): Availability {
  const match = AVAILABILITIES.find((candidate) => candidate === value);
  if (!match) throw new Error(`Unknown availability ${value}`);
  return match;
}
