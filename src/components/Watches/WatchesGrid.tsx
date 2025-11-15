import { WatchCard } from "@/components/Watches/WatchCard";

import { Product } from "../../app/watches/type";

export async function WatchesGrid({watches, customerGeoLocation}: {watches: Product[], customerGeoLocation: string}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {watches.map((watch) => (
        <WatchCard key={watch.id} product={watch} customerGeoLocation={customerGeoLocation} />
      ))}
    </div>
  );
}