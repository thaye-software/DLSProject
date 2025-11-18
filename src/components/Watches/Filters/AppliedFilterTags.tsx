"use client"

import { buildFilterParams, WatchFilters } from "./ProductFilterSheet";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { formatPrice } from "./ProductFilterSheet";
import { useRouter } from "next/navigation";
import { JSX } from "react";

export default function AppliedFiltersTag({ defaultFilter, appliedFilters, localCurrencyCode }: { defaultFilter: WatchFilters; appliedFilters: Partial<WatchFilters>; localCurrencyCode: string }) {
  const router = useRouter();
  const filterGroups = buildFilterGroups(appliedFilters, removeFilter);

  function buildFilterGroups(
    appliedFilters: Partial<WatchFilters>,
    onRemoveFilter: (filterType: string, value?: string) => void
  ): JSX.Element[] {
    const groups: JSX.Element[] = [];

    if (!appliedFilters) return groups;

    // Brand filters group
    if (appliedFilters.brandNames && appliedFilters.brandNames.length > 0) {
      const brandArray = Array.isArray(appliedFilters.brandNames)
        ? appliedFilters.brandNames
        : [appliedFilters.brandNames];
      
      const brandButtons = brandArray.map((brand) => (
        <Button
          key={`brand-${brand}`}
          variant="ghost"
          size="sm"
          className="gap-1 border-2 hover:cursor-pointer"
          onClick={() => onRemoveFilter("brandNames", brand)}
        >
          {brand}
          <X className="h-3 w-3" />
        </Button>
      ));

      groups.push(
        <div key="brand-group" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Brand:</span>
          {brandButtons}
        </div>
      );
    }

    // Price filters
    if (appliedFilters.minPrice || appliedFilters.maxPrice) {
      const priceLabel = appliedFilters.minPrice && appliedFilters.maxPrice
        ? `${formatPrice(Number(appliedFilters?.minPrice), localCurrencyCode)} - ${formatPrice(Number(appliedFilters?.maxPrice), localCurrencyCode)}`
        : appliedFilters.minPrice
        ? `> ${formatPrice(Number(appliedFilters?.minPrice), localCurrencyCode)}`
        : `Up to ${ formatPrice(Number(appliedFilters?.maxPrice), localCurrencyCode)}`;

      groups.push(
        <div key="price-group" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Price:</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 border-2 hover:cursor-pointer"
            onClick={() => {
              onRemoveFilter("priceFilter");
            }}
          >
            {priceLabel}
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    // Size filters
    if (appliedFilters.minSize || appliedFilters.maxSize) {
      const sizeLabel = appliedFilters.minSize && appliedFilters.maxSize
        ? `${appliedFilters.minSize}mm - ${appliedFilters.maxSize}mm`
        : appliedFilters.minSize
        ? `> ${appliedFilters.minSize}mm`
        : `Up to ${appliedFilters.maxSize}mm`;

      groups.push(
        <div key="size-group" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Size:</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 border-2 hover:cursor-pointer"
            onClick={() => {
              onRemoveFilter("sizeFilter");
            }}
          >
            {sizeLabel}
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    // Year filters
    if (appliedFilters.yearStart || appliedFilters.yearEnd) {
      const yearLabel = appliedFilters.yearStart && appliedFilters.yearEnd
        ? `${appliedFilters.yearStart} - ${appliedFilters.yearEnd}`
        : appliedFilters.yearStart
        ? `> ${appliedFilters.yearStart}`
        : `Until ${appliedFilters.yearEnd}`;

      groups.push(
        <div key="year-group" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Year:</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 border-2 hover:cursor-pointer"
            onClick={() => {
              onRemoveFilter("yearFilter");
            }}
          >
            {yearLabel}
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    // Condition filters group
    if (appliedFilters.conditionValues && appliedFilters.conditionValues.length > 0) {
      const conditionArray = Array.isArray(appliedFilters.conditionValues)
        ? appliedFilters.conditionValues
        : [appliedFilters.conditionValues];
      
      const conditionButtons = conditionArray.map((condition) => (
        <Button
          key={`condition-${condition}`}
          variant="ghost"
          size="sm"
          className="gap-1 border-2 hover:cursor-pointer"
          onClick={() => onRemoveFilter?.("conditionValues", condition)}
        >
          {condition}/10 {/* TODO should fetch highest condition from db  */}
          <X className="h-3 w-3" />
        </Button>
      ));

      groups.push(
        <div key="condition-group" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Condition:</span>
          {conditionButtons}
        </div>
      );
    }

    return groups;
  }

  function removeFilter(filterType: string, filterValue?: string) {
    // Create a copy of appliedFilters
    const updatedFilters: Partial<WatchFilters> = { ...appliedFilters };

    if (!updatedFilters) return;

    switch (filterType) {
      case "brandNames":
        if (filterValue && updatedFilters.brandNames) {
          updatedFilters.brandNames = updatedFilters.brandNames.filter((name) => name !== filterValue);
        }
        break;

      case "conditionValues":
        if (filterValue && updatedFilters.conditionValues) {
          updatedFilters.conditionValues = updatedFilters.conditionValues.filter((c) => c !== filterValue);
        }
        break;

      case "priceFilter":
        updatedFilters.minPrice = null;
        updatedFilters.maxPrice = null;
        break;

      case "sizeFilter":
        updatedFilters.minSize = null;
        updatedFilters.maxSize = null;
        break;

      case "yearFilter":
        updatedFilters.yearEnd = null;
        updatedFilters.yearStart = null;
        break;
    }


    console.log(updatedFilters);
    const params = buildFilterParams(updatedFilters, defaultFilter);
  
    // params is type URLSearchParams so if nothign set calling toString() will return
    if (params.toString()) { 
      router.push(`/watches?${params.toString()}`);
    } else {
      router.push(`/watches`);
    }
  }


  if (filterGroups.length === 0) {
    return null; // Don't render anything if no filters applied
  }

  return (
    <div className="flex flex-wrap gap-3 my-4">
      {filterGroups}
    </div>
  );
}



//---------------------------------- helper functions ----------------------------------

