import { Metadata } from "next";
import { Suspense } from "react";
import { SearchParams } from "next/dist/server/request/search-params";

import { Spinner } from "@/components/ui/spinner";

import { WatchesGrid } from "@/components/Watches/WatchesGrid";
import AppliedFiltersTag from "@/components/Watches/Filters/AppliedFilterTags";
import { ProductFilterSheet, WatchFilters } from "@/components/Watches/Filters/ProductFilterSheet";

import { getAllBrands } from "@/services/brandService"
import { watchService } from "@/services/watchService";
import { convertCurrency } from "@/services/currencyService";
import { getAllProducts, getFilterPriceRange, getFilteredProducts } from "@/services/productService";

import { baseUrl } from "@/lib/utils/client/utils";
import { getUserLocation } from "@/lib/utils/server/utils";




export async function generateMetadata(): Promise<Metadata> {
  const allProducts = await getAllProducts();
  const keywords = allProducts.map((product) => product.watch.model + " " + product.watch.brand.name);

  return {
    title: "Watches | Finite Watches",
    description: "Explore our extensive collection of watches from top brands around the world.",
    keywords: [
      "watches",
      "wrist watches",
      "luxury watches",
      ...keywords
    ],
    alternates: {
      canonical: `${baseUrl}/watches`,
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
    }
  }
};



export default async function FilterdWatches({searchParams}: {searchParams: SearchParams}) {

  const params = (await searchParams);
  const appliedFilters: Partial<WatchFilters> = normalizeSearchParams(params);
  const filteredProducts = await getFilteredProducts(appliedFilters)
  
  const userGeoLocationData = await getUserLocation();
  const customerGeoLocation = userGeoLocationData.countryCode;
  const localCurrencyCode = userGeoLocationData.currency;

  //TODO refactor the getFilterRanges, so it only gets the filters by querying the products table, and only if they are visible...
  const defaultFilters = await getFilterRanges(userGeoLocationData.currency);
  const syncedFilters = syncFilters(defaultFilters, appliedFilters);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Watches</h1>
      <ProductFilterSheet 
        className={"mt-2"}
        appliedFilters={syncedFilters} 
        defaultFilters={defaultFilters}  
        localCurrencyCode={localCurrencyCode}
      />

      <AppliedFiltersTag 
        appliedFilters={appliedFilters} 
        defaultFilter={defaultFilters}
        localCurrencyCode={localCurrencyCode}
      />

      <div className="flex justify-center mt-10">
        {filteredProducts && filteredProducts.length > 0 ? (
          <Suspense fallback={<Spinner className="w-8 h-8" />}>
            {/*@ts-ignore*/}
            <WatchesGrid watches={filteredProducts} customerGeoLocation={customerGeoLocation}/>
          </Suspense>
        ) : (
         <div className="flex justify-center items-center py-20 text-gray-500 text-lg font-medium">
            Unfortunately there were no products found...
          </div>
        )}
      </div>
    </div>
  );
}



//------------------------------------------- helper functions -------------------------------------------
  
export async function getFilterRanges(localCurrencyCode: string): Promise<WatchFilters> {
  const allBrands = await getAllBrands();
  const allBrandNames = allBrands.map((brand) => brand.name);
  
  const filterPriceRange = await getFilterPriceRange();
  const lowestPrice = await convertCurrency(filterPriceRange.lowest, localCurrencyCode);  
  const highestPrice = await convertCurrency(filterPriceRange.highest, localCurrencyCode); 
  
  const sizeRange = await watchService.getFilterSizeRange();
  const yearRange = await watchService.getFilterYearRange();
  const uniqueConditions = await watchService.getUniqueConditions();

  return {
    brandNames: [...allBrandNames],
    minPrice: String(lowestPrice),
    maxPrice: String(highestPrice),
    minSize: String(sizeRange.smallest),
    maxSize: String(sizeRange.largest),
    yearStart: String(yearRange.oldest),
    yearEnd: String(yearRange.newest),
    conditionValues: uniqueConditions.map((conditionObject) => String(conditionObject.condition)),
    conditionStats: uniqueConditions
  }
}

function syncFilters(
  defaultFilter: WatchFilters,
  appliedFilters: Partial<WatchFilters>
): WatchFilters {

  // Cloning the object to avoid mutating the original object...
  const syncedFilter: WatchFilters = {
    brandNames: [],
    minPrice: defaultFilter.minPrice,
    maxPrice: defaultFilter.maxPrice,
    minSize: defaultFilter.minSize,
    maxSize: defaultFilter.maxSize,
    yearStart: defaultFilter.yearStart,
    yearEnd: defaultFilter.yearEnd,
    conditionValues: [],
    conditionStats: defaultFilter.conditionStats.map(condition => ({ ...condition })),
  };

  if (appliedFilters.brandNames) {
      syncedFilter.brandNames = defaultFilter.brandNames.filter(name =>
        appliedFilters.brandNames?.includes(name)
    );
  }



  if (appliedFilters.conditionValues) {
      syncedFilter.conditionValues = defaultFilter.conditionValues.filter( value =>
        appliedFilters.conditionValues?.includes(value)
    );
  }

  

  if (appliedFilters.minPrice) {
    syncedFilter.minPrice = appliedFilters.minPrice;
  }
  if (appliedFilters.maxPrice) {
    syncedFilter.maxPrice = appliedFilters.maxPrice;
  }



  if (appliedFilters.minSize) {
    syncedFilter.minSize = appliedFilters.minSize;
  }
  if (appliedFilters.maxSize) {
    syncedFilter.maxSize = appliedFilters.maxSize;
  }

 

  if (appliedFilters.yearStart) {
    syncedFilter.yearStart = appliedFilters.yearStart;
  }
  if (appliedFilters.yearEnd) {
    syncedFilter.yearEnd = appliedFilters.yearEnd;
  }

  return syncedFilter;
}


function normalizeSearchParams(params: Record<string, any>): Partial<WatchFilters> {
  const appliedFilters: Partial<WatchFilters> = {};

  if (params.brand) {
    appliedFilters.brandNames = Array.isArray(params.brand) ? params.brand : [params.brand];
  }

  if (params.condition) {

    appliedFilters.conditionValues = Array.isArray(params.condition)
      ? params.condition
      : [params.condition];
  }

  if (params.minPrice) appliedFilters.minPrice = params.minPrice;
  if (params.maxPrice) appliedFilters.maxPrice = params.maxPrice;

  if (params.minSize) appliedFilters.minSize = params.minSize;
  if (params.maxSize) appliedFilters.maxSize = params.maxSize;

  if (params.yearStart) appliedFilters.yearStart = params.yearStart;
  if (params.yearEnd) appliedFilters.yearEnd = params.yearEnd;

  return appliedFilters;
}
