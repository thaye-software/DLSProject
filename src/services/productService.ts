"use server";

import { db } from "@/database/drizzle";
import { products, brands, watches } from "@/database/schema.ts";
import { NewProductModel, ProductModel } from "@/database/types";

import { Product } from "../app/watches/type";
import { eq } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];



export async function getProductBySlug(
  watchSlug: string
): Promise<Product | null> {
  try {
    const watch = await db.query.watches.findFirst({
      where: eq(watches.slug, watchSlug),
      with: {
        product: {
          with: {
            productImages: true,
          },
        },
        brand: true,
      },
    });

    if (watch === undefined || watch === null) {
      return null;
    }

    const product: Product = {
      ...watch.product,
      watch: {
        ...watch,
        brand: watch.brand,
      },
      productImages: watch.product.productImages,
    };

    return product;
  } catch (error) {
    console.error("(server) Unexpected error getting product...",error);
    throw error;
  }
}

export async function getProductById(id: number, tx?: DbTransaction): Promise<ProductModel | undefined> {
  try {
    const dbContext = tx || db;
    const foundProduct = await dbContext.query.products.findFirst({
      where: eq(products.id, id)
    });
    return foundProduct;

  } catch (error) {
    console.error(`(server) faild to get product by id: ${id}`, error);
    throw error;
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    const allProducts: Product[] = await db.query.products.findMany({
      with: {
        watch: {
          with: {
            brand: true,
          },
        },
        productImages: true,
      },
    });

    return allProducts;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw new Error("Failed to fetch products from database");
  }
}

// TODO: optimise this function
export async function getAllProductsByBrandName(
  brandName: string
): Promise<Product[]> {
  try {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.slug, brandName.toLocaleLowerCase()),
    });

    if (!brand) {
      return [];
    }

    const allProducts: Product[] = await getAllProducts();

    const filteredProducts = allProducts.filter(
      (product) => product.watch?.brand.id === brand.id
    );

    return filteredProducts;
  } catch (error) {
    console.error("Error fetching products by brand slug:", error);
    throw new Error("Failed to fetch products from database");
  }
}

export async function searchProducts(query: string) {
  const lowerQuery = query.trim().toLowerCase();
  try {
    const results = await db.query.products.findMany({
      with: {
        watch: {
          with: {
            brand: true,
          },
        },
        productImages: true,
      },
    });

    // not optimal, but i cant figure out how to do it in the query
    // maybe try to optimitze later
    const filteredResults = results.filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(lowerQuery);
      const brandMatch = product.watch?.brand.name
        .toLowerCase()
        .includes(lowerQuery);
      const referenceMatch = product.watch?.reference
        .toLowerCase()
        .includes(lowerQuery);

      return nameMatch || brandMatch || referenceMatch;
    });

    return filteredResults;
  } catch (error) {
    console.error("Error searching products:", error);
    throw new Error("Failed to search products in database");
  }
}



export async function createProduct(
  data: Omit<NewProductModel, "id" | "createdAt">
) {
  try {
    const result = await db.insert(products).values(data).returning();
    return { success: true, data: result[0] };
  } catch (error) {
    console.error("Error creating product:", error);
    return { success: false, error: "Failed to create product" };
  }
}



export async function updateProductStock(productId: number, stock: number, tx?: DbTransaction) {
  try {
    const dbContext = tx || db;
    const updatedProduct = await dbContext.update(products).set({stock}).where(eq(products.id, productId)).returning();
    return updatedProduct[0];

  } catch (error) {
    console.error("(server) failed to update the stock on product...", error);
    throw error;
  }
}
