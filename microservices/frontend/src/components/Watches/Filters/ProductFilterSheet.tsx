"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type FilterValues = {
  q?: string;
  brand?: string;
  availability?: string;
  minPriceDkk?: number;
  maxPriceDkk?: number;
};
export type BrandOption = { slug: string; name: string };

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ProductFilterSheet({
  className,
  applied,
  brands,
}: {
  className?: string;
  applied: FilterValues;
  brands: BrandOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  // on /watches/[brand] the brand comes from the path
  const showBrandFilter = pathname === "/watches";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(applied.q ?? "");
  const [brand, setBrand] = useState(applied.brand ?? "");
  const [availability, setAvailability] = useState(applied.availability ?? "available");
  const [min, setMin] = useState(applied.minPriceDkk?.toString() ?? "");
  const [max, setMax] = useState(applied.maxPriceDkk?.toString() ?? "");

  function reset() {
    setQ("");
    setBrand("");
    setAvailability("available");
    setMin("");
    setMax("");
  }

  function apply() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (showBrandFilter && brand) params.set("brand", brand);
    if (availability !== "available") params.set("availability", availability);
    if (min) params.set("minPrice", min);
    if (max) params.set("maxPrice", max);
    setOpen(false);
    router.push(`${pathname}?${params}`);
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
            <SheetDescription>Apply filters to find exactly what you&apos;re looking for.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={reset} className="text-muted-foreground">
                Reset filter
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-q">Search</Label>
              <Input id="filter-q" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {showBrandFilter && (
              <div className="space-y-2">
                <Label htmlFor="filter-brand">Brand</Label>
                <select
                  id="filter-brand"
                  className={selectClass}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="filter-availability">Availability</Label>
              <select
                id="filter-availability"
                className={selectClass}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
              >
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Price (DKK)</Label>
              <div className="flex gap-2">
                <Input type="number" min={0} placeholder="Min" aria-label="Minimum price" value={min} onChange={(e) => setMin(e.target.value)} />
                <Input type="number" min={0} placeholder="Max" aria-label="Maximum price" value={max} onChange={(e) => setMax(e.target.value)} />
              </div>
            </div>
          </div>

          <SheetFooter className="border-t pt-4">
            <div className="flex items-center justify-evenly w-full gap-2">
              <Button onClick={apply} className="flex-1">
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
