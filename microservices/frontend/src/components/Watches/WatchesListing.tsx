import { WatchesGrid } from "@/components/Watches/WatchesGrid";
import { searchProducts, type SearchFilters } from "@/services/searchService";

export async function WatchesListing({ filters }: { filters: SearchFilters }) {
  let items;
  try {
    items = (await searchProducts({ pageSize: 24, ...filters })).items;
  } catch {
    return (
      <div className="flex justify-center items-center py-20 text-destructive text-lg font-medium">
        Watches could not be loaded right now. Please try again later.
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 text-lg font-medium">
        Unfortunately there were no products found...
      </div>
    );
  }
  return <WatchesGrid watches={items} />;
}
