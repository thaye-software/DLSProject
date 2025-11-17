import { WatchCard } from "@/components/Watches/WatchCard";

import { Product } from "../../app/watches/type";
import { getLocalCurrencyString } from "@/services/currencyService";

export async function WatchesGrid({
  watches,
  customerGeoLocation,
}: {
  watches: Product[];
  customerGeoLocation: string;
}) {
  async function getFormattedPrice( productPriceDkk: number) {
    return await getLocalCurrencyString(productPriceDkk, customerGeoLocation);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full">
      {watches.map((watch, i) => (
        <WatchCard
          key={watch.id}
          product={watch}
          formattedPrice={getFormattedPrice(watch.priceDkk)}
          index={i}
        />
      ))}
    </div>
  );
}
