"use server";

import { db } from "@/database/drizzle";
import { products, brands, watches, productImages } from "@/database/schema.ts";
import { NewProductModel, ProductModel } from "@/database/types";

import { Product } from "../app/watches/type";
import { and, gte, lte, inArray, eq, desc, asc } from "drizzle-orm";
import { WatchFilters } from "@/components/Watches/Filters/ProductFilterSheet";

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

export async function getProductById(id: string, tx?: DbTransaction): Promise<ProductModel | undefined> {
  try {
    const dbContext = tx || db;
    const foundProduct = await dbContext.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        productImages: true,
        watch: {
          with: {
            brand: true
          }
        }
      }
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

export async function getFilteredProducts(filters: Partial<WatchFilters>): Promise<Product[]> {
  try {
    const appliedSearchFilters = getAppliedSerachFilters(filters);
    const filter = appliedSearchFilters.length ? appliedSearchFilters : undefined;

    // this does not seem to work, filtering by brandname, condition, etc is broken

    // const results = await db.query.products.findMany({
    //   where: and(...(filter || []), gte(products.stock, 1)),
    //   with: {
    //     watch: {
    //       with: {
    //         brand: true,
    //       },
    //     },
    //     productImages: true,
    //   },
    // });
    // return results;


    // old version of the code below

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
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.isThumbnail, true)
        )
    )
      // show products where stock >= 1
      .where(and(filter));



    const filteredProducts: Product[] = rows.map((row) => ({
      id: row.product.id,
      name: row.product.name,
      priceDkk: row.product.priceDkk,
      stock: row.product.stock,
      productType: row.product.productType,
      description: row.product.description,

      watch: {
        ...row.watch,
        brand: {
          ...row.brand
        }
      },

      productImages: row.image
        ? [
            {
              id: "thumbnial",
              productId: row.product.id,
              imageUrl: row.image,
              isThumbnail: true,
            },
          ]
        : [],
    }));

    return filteredProducts;

  } catch (error) {
    console.error(`(server) failed to filter products with filters: ${filters}`, error);
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

export async function searchProducts(query: string): Promise<Product[]> {
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



export async function updateProductStock(productId: string, stock: number, tx?: DbTransaction): Promise<void> {
  try {
    const dbContext = tx || db;
    await dbContext.update(products).set({stock}).where(eq(products.id, productId)).returning();

  } catch (error) {
    console.error("(server) failed to update the stock on product...", error);
    throw error;
  }
}



//------------------------------------------ helper functions ------------------------------------------
function getAppliedSerachFilters(filters: Partial<WatchFilters>) {

  const appliedSearchFilters = [];

  if (filters.brandNames && filters.brandNames?.length > 0) {
    const brandArray = Array.isArray(filters.brandNames) ? filters.brandNames : [filters.brandNames]; // force single string into array
    appliedSearchFilters.push(inArray(brands.name, brandArray));
  }



  if (filters.conditionValues && filters.conditionValues.length > 0) {
    const conditionArray = Array.isArray(filters.conditionValues) ? filters.conditionValues.map(Number) : [Number(filters.conditionValues)] // convert all to numbers
    appliedSearchFilters.push(inArray(watches.condition, conditionArray));
  }



  if (filters.maxPrice) {
    appliedSearchFilters.push(lte(products.priceDkk, Number(filters.maxPrice) * 100));
  }
  if (filters.minPrice) {
    appliedSearchFilters.push(gte(products.priceDkk, Number(filters.minPrice) * 100)); // convert back to cents/øre
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

  return appliedSearchFilters;
}