import { WatchCard } from "@/components/Watches/WatchCard";
import type { ProductListing } from "@/services/searchService";

export function WatchesGrid({ watches }: { watches: ProductListing[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full">
      {watches.map((product, i) => (
        <WatchCard key={product.product_id} product={product} index={i} />
      ))}
    </div>
  );
}
