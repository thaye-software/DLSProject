import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";
import { WatchesGrid } from "@/components/Watches/WatchesGrid";

import { getAllProductsByBrandName } from "@/services/productService";

import { getUserLocation } from "@/lib/utils/server/utils";
import { getFilterRanges } from "../page";
import { ProductFilterSheet } from "@/components/Watches/Filters/ProductFilterSheet";
import { ProductModel } from "@/database/types";

export default async function BrandWatchesPage({
  params,
}: {
  params: Promise<{ brandName: string }>;
}) {
  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;

  let brandName = (await params).brandName;
  brandName = capitalizeFirstLetter(brandName);

  const allWatches: ProductModel[] = await getAllProductsByBrandName(brandName);

  const localCurrencyCode = userGeoLocationData.currency;

  const filters = await getFilterRanges(userGeoLocationData.currency);
  const appliedFilters = {...filters};
  appliedFilters.brandNames = [];
  appliedFilters.conditionValues = [];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">{brandName} Watches</h1>
      <ProductFilterSheet className="mb-10" defaultFilters={filters} appliedFilters={appliedFilters} localCurrencyCode={localCurrencyCode}/>

      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8"/>}>
          <WatchesGrid watches={allWatches} customerGeoLocation={countryCode}/>
        </Suspense>
      </div>
    </div>
  );
}

// ---------------------------- helper functions ----------------------------
function capitalizeFirstLetter(brandName: string): string {
  const capitalFirstLetter = brandName.substring(0, 1).toLocaleUpperCase();
  const formatedBrandName =
    capitalFirstLetter + brandName.slice(1, brandName.length);
  return formatedBrandName;
}
