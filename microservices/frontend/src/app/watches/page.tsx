import { Metadata } from "next";

import { ProductFilterSheet, type BrandOption } from "@/components/Watches/Filters/ProductFilterSheet";
import { WatchesListing } from "@/components/Watches/WatchesListing";

import { baseUrl } from "@/lib/utils/client/utils";
import { filtersFromParams, searchProducts } from "@/services/searchService";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watches | Finite Watches",
  description: "Explore our extensive collection of watches from top brands around the world.",
  keywords: ["watches", "wrist watches", "luxury watches"],
  alternates: { canonical: `${baseUrl}/watches` },
  robots: { index: true, follow: true, nocache: false },
};

// No brands endpoint exists, so the filter's brand options come from the listings themselves.
async function loadBrands(): Promise<BrandOption[]> {
  try {
    const { items } = await searchProducts({ pageSize: 100 });
    const bySlug = new Map<string, string>();
    for (const i of items) if (i.brand_slug && i.brand_name) bySlug.set(i.brand_slug, i.brand_name);
    return [...bySlug].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export default async function FilteredWatches({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromParams(await searchParams);
  const brands = await loadBrands();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Watches</h1>
      <ProductFilterSheet className="mt-2" applied={filters} brands={brands} />
      <div className="flex justify-center mt-10">
        <WatchesListing filters={filters} />
      </div>
    </div>
  );
}
