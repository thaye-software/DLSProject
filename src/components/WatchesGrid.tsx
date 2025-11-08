import { WatchCard } from "@/components/WatchCard";
import { productService } from "@/services/productService";
import { Products } from "../app/watches/type";

// The async component that fetches
export async function WatchesGrid({watches}: {watches: Products[]}) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
//   const watches: Products[] = await productService.getAllProducts();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {watches.map((watch) => (
        <WatchCard key={watch.id} watch={watch} />
      ))}
    </div>
  );
}