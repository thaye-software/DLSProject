import { WatchesGrid } from "@/components/WatchesGrid";

import { productService } from "@/services/productService";

import { Products } from "../type";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";


export default async function AllWatches() {

   await new Promise((resolve) => setTimeout(resolve, 2000))
  const watches: Products[] = await productService.getAllProducts();


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">All Watches</h1>
      <p className="text-muted-foreground mb-8">This is the page that lists all watches.</p>
      
      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8"/>}>
          <WatchesGrid watches={watches}/>
        </Suspense>
      </div>
    </div>
  );
}