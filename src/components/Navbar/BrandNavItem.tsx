"use client";

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandModel } from "@/database/types";
import { getAllBrands } from "@/services/brandService";

export default function BrandNavItem() {
  const [brands, setBrands] = useState<BrandModel[]>([]);

  useEffect(() => {
    async function fetchBrands() {
      const fetchedBrands = await getAllBrands();
      setBrands(fetchedBrands);
    }
    fetchBrands();
  }, []);

  return (
    <NavigationMenuItem className="hidden md:block" suppressHydrationWarning>
      <NavigationMenuTrigger className="font-bold">
        Brands
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[200px] gap-2">
          {brands.map((brand) => (
            <li key={brand.id}>
              <NavigationMenuLink asChild>
                <Link
                  href={`/watches/${brand.slug}`}
                >
                  {brand.name}
                </Link>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}