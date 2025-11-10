import { WatchesGrid } from "@/components/Watches/WatchesGrid";

import { productService } from "@/services/productService";

import { Product } from "../type";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";


export default async function AllWatches() {

  // to be implemented 
  // get user country and convert price accordingly
  // const countryCode = getUserCountryCode(); // placeholder function
  // use header/cookies to get userId / countrty id etc.
  const countryCode = "DKK";
  const watches: Product[] = await productService.getAllProducts();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">All Watches</h1>
      <p className="text-muted-foreground mb-8">This is the page that lists all watches.</p>
      
      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8"/>}>
          <WatchesGrid watches={watches} countryCode={countryCode}/>
        </Suspense>
      </div>
    </div>
  );
}