import { Metadata } from "next";

import { ProductFilterSheet } from "@/components/Watches/Filters/ProductFilterSheet";
import { WatchesListing } from "@/components/Watches/WatchesListing";

import { baseUrl } from "@/lib/utils/client/utils";
import { filtersFromParams } from "@/services/searchService";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Limited Edition Watches | Finite Watches",
  description: "Discover our exclusive limited edition watches.",
  alternates: { canonical: `${baseUrl}/watches/limited` },
  robots: { index: true, follow: true, nocache: false },
};

// Search cannot filter on `limited`, so this shows the normal listing.
export default async function LimitedWatches({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromParams(await searchParams);
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Limited Edition Watches</h1>
      <ProductFilterSheet className="mt-2" applied={filters} brands={[]} />
      <div className="flex justify-center mt-10">
        <WatchesListing filters={filters} />
      </div>
    </div>
  );
}
