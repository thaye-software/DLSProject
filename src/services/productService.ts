"use server";

import { db, DbTransaction } from "@/database/drizzle";
import { products, brands, watches, productImages } from "@/database/schema.ts";
import { NewProductModel, ProductModel } from "@/database/types";

import { Product } from "../app/watches/type";
import { and, gte, lte, inArray, eq, desc, asc, sql, gt, or, ilike } from "drizzle-orm";
import { WatchFilters } from "@/components/Watches/Filters/ProductFilterSheet";



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
    console.error("(server) Unexpected error getting product...", error);
    throw error;
  }
}

export async function getProductById(
  id: string,
  tx?: DbTransaction
): Promise<ProductModel | undefined> {
  try {
    const dbContext = tx || db;
    const foundProduct = await dbContext.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        productImages: true,
        watch: {
          with: {
            brand: true,
          },
        },
      },
    });
    return foundProduct;
  } catch (error) {
    console.error(`(server) faild to get product by id: ${id}`, error);
    throw error;
  }
}

export async function getAllProducts(): Promise<ProductModel[]> {
  try {
    const allProducts: ProductModel[] = await db.query.products.findMany({
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

export async function getTotalProductStock() {
  try {
    const totalStock = await db
      .select({
        total: sql<number>`SUM(${products.stock})`,
      })
      .from(products);

    return totalStock[0].total;

  } catch (error) {
    console.error("(server) failed to get total product stock", error);
    throw error;
  }
} 

export async function getFilteredProducts(
  filters: Partial<WatchFilters>
): Promise<Product[]> {
  try {
    const appliedSearchFilters = getAppliedSerachFilters(filters);
    const filter =
      appliedSearchFilters.length > 0
        ? and(...appliedSearchFilters)
        : undefined;

    const rows = await db
      .select({
        watch: watches,
        product: products,
        brand: brands,
        image: productImages.imageUrl,
      })
      .from(watches)
      .innerJoin(products, eq(products.id, watches.productId))
      .innerJoin(brands, eq(brands.id, watches.brandId))
      .leftJoin(productImages, and(eq(productImages.productId, products.id)))
      .where(filter);

    // rows may contain multiple rows per product when there are many images
    // (left join on productImages produces one row per image). Group by
    // product id to ensure each product only appears once in the result set
    // and aggregate unique images for each product.
    const productsMap = new Map<string, Product>();

    for (const row of rows) {
      const pid = row.product.id;

      const imageObj = row.image
        ? {
            id: "thumbnail",
            productId: row.product.id,
            imageUrl: row.image,
            isThumbnail: true,
          }
        : null;

      if (!productsMap.has(pid)) {
        productsMap.set(pid, {
          id: row.product.id,
          name: row.product.name,
          priceDkk: row.product.priceDkk,
          stock: row.product.stock,
          productType: row.product.productType,
          description: row.product.description,

          watch: {
            ...row.watch,
            brand: {
              ...row.brand,
            },
          },

          productImages: imageObj ? [imageObj] : [],
        });
      } else if (imageObj) {
        // avoid adding duplicate identical image URLs
        const p = productsMap.get(pid)!;
        if (
          !p.productImages.some((img) => img.imageUrl === imageObj.imageUrl)
        ) {
          p.productImages.push(imageObj);
        }
      }
    }

    const filteredProducts: Product[] = Array.from(productsMap.values());

    return filteredProducts;
  } catch (error) {
    console.error(
      `(server) failed to filter products with filters: ${filters}`,
      error
    );
    throw error;
  }
}

// TODO: optimise this function
export async function getAllProductsByBrandName(
  brandName: string
): Promise<ProductModel[]> {
  try {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.slug, brandName.toLocaleLowerCase()),
    });

    if (!brand) {
      return [];
    }

    const allProducts: ProductModel[] = await getAllProducts();

    const filteredProducts = allProducts.filter(
      (product) => product.watch?.brand.id === brand.id
    );

    return filteredProducts;
  } catch (error) {
    console.error("Error fetching products by brand slug:", error);
    throw new Error("Failed to fetch products from database");
  }
}

// export async function searchProducts(query: string): Promise<Product[]> {
//   const searchStr = `%${query.trim()}%`; // SQL wildcard syntax

//   try {
//     // We use db.select() with joins to allow filtering across multiple tables (products, watches, brands)
//     const rows = await db
//       .select({
//         product: products,
//         watch: watches,
//         brand: brands,
//         // Note: Handling images in a flat select requires aggregation or a separate query, 
//         // but for search results, usually just the main data is enough to start.
//       })
//       .from(products)
//       .innerJoin(watches, eq(products.id, watches.productId))
//       .innerJoin(brands, eq(watches.brandId, brands.id))
//       .where(
//         and(
//           gte(products.stock, 1),
//           eq(products.visible, true),
//           or(
//             ilike(products.name, searchStr),
//             ilike(watches.reference, searchStr),
//             ilike(brands.name, searchStr)
//           )
//         )
//     );
//     // Map the rows to Product objects
//     const results: Product[] = rows.map((row) => ({
//       ...row.product,
//       watch: {
//         ...row.watch,
//         brand: row.brand,
//       },
//       productImages: [], // Images can be fetched separately if needed
//     }));

//     return results;
//   } catch (error) {
//     console.error("Error searching products:", error);
//     throw new Error("Failed to search products in database");
//   }
// }

export async function searchProducts(query: string): Promise<Product[]> {
  const lowerQuery = query.trim().toLowerCase();
  try {
    const results = await db.query.products.findMany({
      where: and(gte(products.stock, 1), eq(products.visible, true)),
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

export async function setProductVisibility(
  productId: string,
  visible: boolean
): Promise<void> {
  try {
    await db
      .update(products)
      .set({ visible })
      .where(eq(products.id, productId));
  } catch (error) {
    console.error(
      `(server) failed to set product visibility for productId: ${productId}`,
      error
    );
    throw error;
  }
}

export async function getFilterPriceRange() {
  try {
    const [lowest] = await db
      .select()
      .from(products)
      .orderBy(asc(products.priceDkk))
      .limit(1);

    const [highest] = await db
      .select()
      .from(products)
      .orderBy(desc(products.priceDkk))
      .limit(1);

    return {
      lowest: lowest?.priceDkk ?? 0,
      highest: highest?.priceDkk ?? 42069,
    };
  } catch (error) {
    console.error("(server) failed to get price extremes", error);
    throw error;
  }
}

export async function createProduct(
  data: Omit<NewProductModel, "id" | "createdAt">
): Promise<Omit<ProductModel, "productImages" | "watch">> {
  try {
    const result = await db.insert(products).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

export async function checkAndUpdateProductStock(
  productId: string,
  tx?: DbTransaction
): Promise<boolean> {
  try {
    const dbContext = tx || db;

    const result = await dbContext
      .update(products)
      .set({
        stock: sql`${products.stock} - 1`, // hardcoded 1 since requirment that customer can only buy one watch at a time.
      })
      .where(and(eq(products.id, productId), gt(products.stock, 0)))
      .returning({ updatedStock: products.stock });

    // If result is empty, means stock not availabe
    return result.length > 0;
  } catch (error) {
    console.error("(server) failed to decremant stock", error);
    throw error;
  }
}





export async function updateProductStock(
  productId: string,
  quantity: number,
  tx?: DbTransaction,
  isIncrement: boolean = true
) {
  if (quantity <= 0) {
    throw new Error("Quantity must be a positive number.");
  }

  const dbContext = tx || db;

  try {
    const updatedProduct = await dbContext
      .update(products)
      .set({
        stock: isIncrement
          ? sql`${products.stock} + ${quantity}`
          : sql`${products.stock} - ${quantity}`
      })
      .where(eq(products.id, productId))
      .returning();

      
    const product = updatedProduct[0];
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.stock < 0) {
      throw new Error("Stock update resulted in negative stock");
    }

    return product;

  } catch (error) {
    console.error("Failed to update product stock:", error);
    throw error;
  }
}



//------------------------------------------ helper functions ------------------------------------------
function getAppliedSerachFilters(filters: Partial<WatchFilters>) {
  const appliedSearchFilters = [];

  appliedSearchFilters.push(gte(products.stock, 1));
  appliedSearchFilters.push(eq(products.visible, true));

  if (filters.brandNames && filters.brandNames?.length > 0) {
    const brandArray = Array.isArray(filters.brandNames)
      ? filters.brandNames
      : [filters.brandNames]; // force single string into array
    appliedSearchFilters.push(inArray(brands.name, brandArray));
  }

  if (filters.conditionValues && filters.conditionValues.length > 0) {
    const conditionArray = Array.isArray(filters.conditionValues)
      ? filters.conditionValues.map(Number)
      : [Number(filters.conditionValues)]; // convert all to numbers
    appliedSearchFilters.push(inArray(watches.condition, conditionArray));
  }

  if (filters.maxPrice) {
    appliedSearchFilters.push(
      lte(products.priceDkk, Number(filters.maxPrice) * 100)
    );
  }
  if (filters.minPrice) {
    appliedSearchFilters.push(
      gte(products.priceDkk, Number(filters.minPrice) * 100)
    ); // convert back to cents/øre
  }

  if (filters.yearStart) {
    appliedSearchFilters.push(gte(watches.year, Number(filters.yearStart)));
  }
  if (filters.yearEnd) {
    appliedSearchFilters.push(lte(watches.year, Number(filters.yearEnd)));
  }

  if (filters.minSize) {
    appliedSearchFilters.push(gte(watches.size, Number(filters.minSize)));
  }
  if (filters.maxSize) {
    appliedSearchFilters.push(lte(watches.size, Number(filters.maxSize)));
  }

  if (filters.isLimited) {
    appliedSearchFilters.push(eq(watches.limited, true));
  }

  return appliedSearchFilters;
}
