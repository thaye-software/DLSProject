import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";
import { WatchesGrid } from "@/components/Watches/WatchesGrid";

import { getAllProductsByBrandName } from "@/services/productService";
import { Product } from "../type";


export default async function BrandWatchesPage({ params }: { params: Promise<{ brandName: string }> }) {

  let brandName = (await params).brandName;
  brandName = capitalizeFirstLetter(brandName)

  const allWatches: Product[] = await getAllProductsByBrandName(brandName);
  // to be implemented 
  // get user country and convert price accordingly
  // const countryCode = getUserCountryCode(); // placeholder function
  // use header/cookies to get userId / countrty id etc.
  const countryCode = "DKK";

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-12">{brandName} watches</h1>

      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8" />}>
          <WatchesGrid watches={allWatches} countryCode={countryCode}/>
        </Suspense>
      </div>

    </div>
  );
}



// ---------------------------- helper functions ----------------------------
function capitalizeFirstLetter(brandName: string): string {
  const capitalFirstLetter = brandName.substring(0, 1).toLocaleUpperCase();
  const formatedBrandName = capitalFirstLetter + brandName.slice(1, brandName.length)
  return formatedBrandName;
}