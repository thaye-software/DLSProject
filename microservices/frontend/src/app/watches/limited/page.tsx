import { Metadata } from "next";
import { Suspense } from "react";
import { SearchParams } from "next/dist/server/request/search-params";

import { Spinner } from "@/components/ui/spinner";

import {
  ProductFilterSheet,
  WatchFilters,
} from "@/components/Watches/Filters/ProductFilterSheet";
import { WatchesGrid } from "@/components/Watches/WatchesGrid";
import AppliedFiltersTag from "@/components/Watches/Filters/AppliedFilterTags";

import { getFilterRanges } from "../page";

import { getFilteredProducts } from "@/services/productService";

import { baseUrl } from "@/lib/utils/client/utils";
import { getUserLocation } from "@/lib/utils/server/utils";





export const metadata: Metadata = {
  title: "Limited Edition Watches | Finite Watches",
  description: "Discover our exclusive limited edition watches.",
  keywords: [
    "omega","watches","wrist watches", "limited edition watches", "exclusive watches",
  ],
  alternates: {
    canonical: `${baseUrl}/watches/limited`,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
};

export default async function LimitedWatches({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const appliedFilters: Partial<WatchFilters> = normalizeSearchParams(params);

  // Force limited filter
  appliedFilters.isLimited = true;

  const filteredProducts = await getFilteredProducts(appliedFilters);

  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;
  const localCurrencyCode = userGeoLocationData.currency;

  const defaultFilters = await getFilterRanges(userGeoLocationData.currency);
  const syncedFilters = syncFilters(defaultFilters, appliedFilters);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Limited Edition Watches</h1>
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
            <WatchesGrid
              //@ts-ignore
              watches={filteredProducts}
              customerGeoLocation={countryCode}
            />
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
    conditionStats: defaultFilter.conditionStats.map((condition) => ({
      ...condition,
    })),
  };

  if (appliedFilters.brandNames) {
    syncedFilter.brandNames = defaultFilter.brandNames.filter((name) =>
      appliedFilters.brandNames?.includes(name)
    );
  }

  if (appliedFilters.conditionValues) {
    syncedFilter.conditionValues = defaultFilter.conditionValues.filter(
      (value) => appliedFilters.conditionValues?.includes(value)
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

function normalizeSearchParams(
  params: Record<string, any>
): Partial<WatchFilters> {
  const appliedFilters: Partial<WatchFilters> = {};

  if (params.brand) {
    appliedFilters.brandNames = Array.isArray(params.brand)
      ? params.brand
      : [params.brand];
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
