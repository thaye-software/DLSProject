"use client";
import { WatchCard } from "@/components/Watches/WatchCard";

import { Product } from "../../app/watches/type";
import { getLocalCurrencyString } from "@/services/currencyService";
import { calculateSubtotalCents } from "@/lib/priceUtils";
import { useEffect, useState } from "react";
import { ProductModel } from "@/database/types";
import { getCountryVATByCode } from "@/services/countryService";

export function WatchesGrid({
  watches,
  customerGeoLocation,
  removeOnFavorite,
}: {
  watches: ProductModel[];
  customerGeoLocation: string;
  removeOnFavorite?: boolean;
}) {
  const [products, setProducts] = useState<ProductModel[]>([]);
  const [formattedPrices, setFormattedPrices] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setProducts(watches);

    // compute formatted prices asynchronously and store them in state
    let mounted = true;
    (async () => {
      try {
        // Determine VAT rate for customer location and build formatted prices including VAT.
        const vatRate = await getCountryVATByCode(customerGeoLocation);

        const entries = await Promise.all(
          watches.map(async (p) => {
            // product.priceDkk is stored in DKK cents (net); calculate subtotal (net + VAT) in cents
            const subtotalCents = calculateSubtotalCents(
              p.priceDkk,
              vatRate
            );
            console.log("Subtotal cents with VAT:", subtotalCents);
            const formattedPrice = await getLocalCurrencyString(
              subtotalCents,
              customerGeoLocation
            );
            return [p.id, formattedPrice] as const;
          })
        );

        if (!mounted) return;
        setFormattedPrices(Object.fromEntries(entries));
      } catch (e) {
        // don't block rendering on formatting errors
        // eslint-disable-next-line no-console
        console.error("Failed to format prices", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [watches, customerGeoLocation]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full">
      {products.map((product, i) => (
        <WatchCard
          key={product.id}
          product={product}
          formattedPrice={formattedPrices[product.id] ?? ""}
          index={i}
          onFavoriteClick={() => {
            if (removeOnFavorite) {
              setProducts((prev) => prev.filter((p) => p.id !== product.id));
            }
          }}
        />
      ))}
    </div>
  );
}
