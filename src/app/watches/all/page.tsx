import { WatchesGrid } from "@/components/Watches/WatchesGrid";

import { getAllProducts } from "@/services/productService";

import { Product } from "../type";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getUserLocation } from "@/lib/utils/server/utils";
import { ProductFilterSheet } from "@/components/Watches/Filters/ProductFilterSheet";

import { brandService } from "@/services/brandService"
import { getFilterPriceRange } from "@/services/productService";
import { convertCurrency } from "@/services/currencyService";
import { watchService } from "@/services/watchService";
import { getFilterRanges } from "../page";

export default async function AllWatches() {

  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;
  const localCurrencyCode = userGeoLocationData.currency;
  const watches: Product[] = await getAllProducts();

  const filters = await getFilterRanges(userGeoLocationData.currency);
  const appliedFilters = {...filters};
  appliedFilters.brandNames = [];
  appliedFilters.conditionValues = [];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">All Watches</h1>
      <ProductFilterSheet className="mb-10" defaultFilters={filters} appliedFilters={appliedFilters} localCurrencyCode={localCurrencyCode}/>

      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8"/>}>
          <WatchesGrid watches={watches} customerGeoLocation={countryCode}/>
        </Suspense>
      </div>
    </div>
  );
}
