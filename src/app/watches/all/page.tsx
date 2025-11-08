import { WatchCard } from "@/components/WatchCard";

import { productService } from "@/services/productService";

import { Products } from "../type";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";


export default async function AllWatches() {

  const watches: Products[] = await productService.getAllProducts();


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">All Watches</h1>
      <p className="text-muted-foreground mb-8">This is the page that lists all watches.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {watches.map((watch) => (
          <Suspense key={watch.id} fallback={<Spinner />}>
            <WatchCard watch={watch} />
          </Suspense>
        ))}
      </div>
    </div>
  );
}