import { Metadata } from "next";

import { ProductFilterSheet } from "@/components/Watches/Filters/ProductFilterSheet";
import { WatchesListing } from "@/components/Watches/WatchesListing";

import { filtersFromParams } from "@/services/searchService";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ brandName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brandName = (await params).brandName;
  return {
    title: `${brandName} | Finite Watches`,
    description: `Discover ${brandName} watches.`,
    robots: { index: true, follow: true, nocache: false },
  };
}

export default async function BrandWatchesPage({ params, searchParams }: Props) {
  // the route segment is the brand slug
  const brand = (await params).brandName;
  const filters = { ...filtersFromParams(await searchParams), brand };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">{brand} Watches</h1>
      <ProductFilterSheet className="mb-10" applied={filters} brands={[]} />
      <div className="flex justify-center">
        <WatchesListing filters={filters} />
      </div>
    </div>
  );
}
