import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";

import { WatchCard } from "@/components/WatchCard";

import { productService } from "@/services/productService";
import { Product } from "../type";
import { resolve } from "path";
import { WatchesGrid } from "@/components/WatchesGrid";


export default async function BrandWatchesPage({ params }: { params: Promise<{ brandName: string }> }) {

  const brandName = (await params).brandName;
  const allWatches: Product[] = await productService.getAllProductsByBrandName(brandName);
  // to be implemented 
  // get user country and convert price accordingly
  // const countryCode = getUserCountryCode(); // placeholder function
  // use header/cookies to get userId / countrty id etc.
  const countryCode = "DKK";

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">Branded watches</h1>
      <p className="text-muted-foreground mb-8">This is the page that lists all branded watches.</p>
      <p>
        {brandName}
      </p>

      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8" />}>
          <WatchesGrid watches={allWatches} countryCode={countryCode}/>
        </Suspense>
      </div>

    </div>
  );
}