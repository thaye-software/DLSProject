import { WatchCard } from "@/components/Watches/WatchCard";

import { Product } from "../../app/watches/type";
import { convertPrice } from "@/services/currencyService";

export async function WatchesGrid({
  watches,
  countryCode,
}: {
  watches: Product[];
  countryCode: string;
}) {
  async function getFormattedPrice(
    productPriceDkk: number,
    countryCode: string
  ) {
    return await convertPrice(productPriceDkk, countryCode.toLowerCase());
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full">
      {watches.map((watch, i) => (
        <WatchCard
          key={watch.id}
          product={watch}
          countryCode={countryCode}
          formattedPrice={getFormattedPrice(watch.priceDkk, countryCode)}
          index={i}
        />
      ))}
    </div>
  );
}
