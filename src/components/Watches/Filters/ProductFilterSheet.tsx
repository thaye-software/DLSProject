"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";

export interface WatchFilters {
  brandNames: string[];
  minPrice: string | null;
  maxPrice: string | null;
  minSize: string | null;
  maxSize: string | null;
  yearStart: string | null;
  yearEnd: string | null;
  conditionValues: string[]; // for URL params
  conditionStats: { condition: number; count: number }[]; // for UI list
}

export function ProductFilterSheet({
  className,
  appliedFilters,
  defaultFilters,
  localCurrencyCode,
}: {
  className?: string;
  appliedFilters: WatchFilters;
  defaultFilters: WatchFilters;
  localCurrencyCode: string;
}) {
  const router = useRouter();

  const [currentFilters, setCurrentFilters] = useState<WatchFilters>(appliedFilters);
  const [open, setOpen] = useState(false);

  function handleBrandChange(brand: string, checked: boolean) {
    setCurrentFilters((prev) => ({
      ...prev,
      brandNames: checked
        ? [...prev.brandNames, brand]
        : prev.brandNames.filter((b) => b !== brand),
    }));
  }

  function handleConditionChange(condition: number, checked: boolean) {
    setCurrentFilters((prev) => ({
      ...prev,
      conditionValues: checked
        ? [...prev.conditionValues, String(condition)]
        : prev.conditionValues.filter((c) => c !== String(condition)),
    }));
  }

  function handleClearFilters() {
    // I cant pass in the default filters, since they contain values for brandName and conditionsValue.
    // I cant modify the object, since it will break, so have to copy the object and modify then pass it
    let defaultSate = { ...defaultFilters };
    defaultSate.brandNames = [];
    defaultSate.conditionValues = [];
    setCurrentFilters(defaultSate);
  }

  // ensure synchonisation with applied filters, and when filters are removed using the applied filters tag
  useEffect(() => {
    setCurrentFilters(appliedFilters);
  }, [appliedFilters]);

  function handleApply() {
    const params = buildFilterParams(currentFilters, defaultFilters);
    setOpen(false);
    router.push(`/watches?${params.toString()}`);
  }

  return (
    <div className={className}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="font-bold">
            <Filter /> Filters
          </Button>
        </SheetTrigger>

        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-2xl">Filters</SheetTitle>
            <SheetDescription>
              Apply filters to find exactly what you're looking for.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 px-4 py-4">
            <div className="flex flex-col h-full">
              {/* Reset Button */}
              <div className="flex justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-muted-foreground"
                >
                  Reset filter
                </Button>
              </div>

              {/* Scrollable section */}
              <div className="flex-1 overflow-y-auto pr-2">
                <Accordion
                  type="multiple"
                  defaultValue={["brand", "price"]}
                  className="w-full"
                >
                  {/* Brand Filter */}
                  <AccordionItem value="brand">
                    <AccordionTrigger>Brand</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {defaultFilters.brandNames.map((brand) => (
                          <div
                            key={brand}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`brand-${brand}`}
                              checked={currentFilters.brandNames.includes(
                                brand
                              )}
                              onCheckedChange={(checked) =>
                                handleBrandChange(brand, !!checked)
                              }
                            />
                            <Label
                              htmlFor={`brand-${brand}`}
                              className="font-normal"
                            >
                              {brand}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Price Filter */}
                  <AccordionItem value="price">
                    <AccordionTrigger>Price</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2">
                        <Slider
                          min={Number(defaultFilters.minPrice)}
                          max={Number(defaultFilters.maxPrice)}
                          step={100}
                          value={[
                            Number(currentFilters.minPrice),
                            Number(currentFilters.maxPrice),
                          ]}
                          onValueChange={(value) =>
                            setCurrentFilters((f) => ({
                              ...f,
                              minPrice: String(value[0]),
                              maxPrice: String(value[1]),
                            }))
                          }
                        />
                        <div className="flex justify-between text-sm text-muted-foreground mt-3">
                          <span>
                            {formatPrice(
                              Number(currentFilters.minPrice),
                              localCurrencyCode
                            )}
                          </span>
                          <span>
                            {formatPrice(
                              Number(currentFilters.maxPrice),
                              localCurrencyCode
                            )}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Size Filter */}
                  <AccordionItem value="size">
                    <AccordionTrigger>Size</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2">
                        <Slider
                          min={Number(defaultFilters.minSize)}
                          max={Number(defaultFilters.maxSize)}
                          step={1}
                          value={[
                            Number(currentFilters.minSize),
                            Number(currentFilters.maxSize),
                          ]}
                          onValueChange={(value) =>
                            setCurrentFilters((f) => ({
                              ...f,
                              minSize: String(value[0]),
                              maxSize: String(value[1]),
                            }))
                          }
                        />
                        <div className="flex justify-between text-sm text-muted-foreground mt-3">
                          <span>{currentFilters.minSize}mm</span>
                          <span>{currentFilters.maxSize}mm</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Year Filter */}
                  <AccordionItem value="year">
                    <AccordionTrigger>Year</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2">
                        <Slider
                          min={Number(defaultFilters.yearStart)}
                          max={Number(defaultFilters.yearEnd)}
                          step={1}
                          value={[
                            Number(currentFilters.yearStart),
                            Number(currentFilters.yearEnd),
                          ]}
                          onValueChange={(value) =>
                            setCurrentFilters((f) => ({
                              ...f,
                              yearStart: String(value[0]),
                              yearEnd: String(value[1]),
                            }))
                          }
                        />
                        <div className="flex justify-between text-sm text-muted-foreground mt-3">
                          <span>{currentFilters.yearStart}</span>
                          <span>{currentFilters.yearEnd}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Condition Filter */}
                  <AccordionItem value="condition">
                    <AccordionTrigger>Condition</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {defaultFilters.conditionStats.map((stat) => (
                          <div
                            key={stat.condition}
                            className="flex justify-between"
                          >
                            <div className="flex gap-2">
                              <Checkbox
                                id={`condition-${stat.condition}`}
                                checked={currentFilters.conditionValues.includes(
                                  String(stat.condition)
                                )}
                                onCheckedChange={(checked) =>
                                  handleConditionChange(
                                    stat.condition,
                                    !!checked
                                  )
                                }
                              />
                              <Label
                                htmlFor={`condition-${stat.condition}`}
                                className="font-normal"
                              >
                                {stat.condition}
                              </Label>
                            </div>
                            {`(${stat.count})`}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>

          {/* Footer */}
          <SheetFooter className="border-t pt-4">
            <div className="flex items-center justify-evenly w-full gap-2">
              <Button onClick={handleApply} className="flex-1">
                Apply filter
              </Button>
              <SheetClose asChild>
                <Button variant="outline" className="flex-1">
                  Close
                </Button>
              </SheetClose>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

//---------------------------------------------- helper functions ----------------------------------------------
export function formatPrice(value: number, localCurrencyCode: string) {
  if (localCurrencyCode.toUpperCase() === "DKK") {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
    }).format(value);
  }
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: localCurrencyCode,
  }).format(value);
}

export function buildFilterParams(
  appliedFilters: Partial<WatchFilters>,
  defaultFilter: WatchFilters
): URLSearchParams {
  const params = new URLSearchParams();

  if (
    appliedFilters.brandNames &&
    appliedFilters.brandNames.length !== defaultFilter.brandNames.length
  ) {
    appliedFilters.brandNames.forEach((name) => params.append("brand", name));
  }

  if (
    appliedFilters.minPrice &&
    appliedFilters.minPrice !== defaultFilter.minPrice
  ) {
    params.set("minPrice", appliedFilters.minPrice);
  }
  if (
    appliedFilters.maxPrice &&
    appliedFilters.maxPrice !== defaultFilter.maxPrice
  ) {
    params.set("maxPrice", appliedFilters.maxPrice);
  }

  if (
    appliedFilters.minSize &&
    appliedFilters.minSize !== defaultFilter.minSize
  ) {
    params.set("minSize", appliedFilters.minSize);
  }
  if (
    appliedFilters.maxSize &&
    appliedFilters.maxSize !== defaultFilter.maxSize
  ) {
    params.set("maxSize", appliedFilters.maxSize);
  }

  if (
    appliedFilters.yearStart &&
    appliedFilters.yearStart !== defaultFilter.yearStart
  ) {
    params.set("yearStart", appliedFilters.yearStart);
  }
  if (
    appliedFilters.yearEnd &&
    appliedFilters.yearEnd !== defaultFilter.yearEnd
  ) {
    params.set("yearEnd", appliedFilters.yearEnd);
  }

  if (
    appliedFilters.conditionValues &&
    appliedFilters.conditionValues.length !==
      defaultFilter.conditionValues.length
  ) {
    appliedFilters.conditionValues.forEach((condition) =>
      params.append("condition", condition)
    );
  }

  return params;
}
