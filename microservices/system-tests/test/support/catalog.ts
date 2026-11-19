import { randomUUID } from "node:crypto";
import { publicCall } from "./gateway.js";
import { compose } from "./stack.js";

export type SeededProduct = { productId: string; name: string; slug: string; priceMinor: number };

export type Availability = "available" | "reserved" | "sold" | "hidden";

const INSERT_PRODUCT = `
import { createDatabase } from "./dist/adapters/db/prisma.js";
import { productData } from "./dist/adapters/db/prisma-product-repository.js";
const database = createDatabase(process.env.DATABASE_URL);
await database.product.create({ data: productData(JSON.parse(process.env.SYSTEM_TEST_PRODUCT)) });
await database.$disconnect();
`;

// Catalog has no admin API for creating products yet, so the row goes in through Catalog's own compiled
// Prisma client inside its container, the same way security-scan.yml seeds its product.
export async function seedProduct({ stock = 1, priceMinor = 4_250_000 }: { stock?: number; priceMinor?: number } = {}): Promise<SeededProduct> {
  const productId = randomUUID();
  const suffix = productId.slice(0, 8);
  const product = {
    productId,
    name: `System Test Chronograph ${suffix}`,
    slug: `system-test-chronograph-${suffix}`,
    brandName: "Omega",
    model: "Speedmaster",
    price: { amountMinor: priceMinor, currency: "DKK" },
    availability: "available",
    thumbnailUrl: null,
    stock,
    version: 1,
  };
  await compose(
    ["exec", "-T", "-e", "SYSTEM_TEST_PRODUCT", "catalog", "node", "--input-type=module", "-e", INSERT_PRODUCT],
    { SYSTEM_TEST_PRODUCT: JSON.stringify(product) },
  );
  return { productId, name: product.name, slug: product.slug, priceMinor };
}

export async function availabilityOf(productId: string): Promise<Availability> {
  const response = await publicCall("catalog", "GET", `/products/${productId}`);
  if (response.status !== 200) throw new Error(`GET /products/${productId} answered ${response.status}`);
  return response.body.availability;
}
