import { WatchesGrid } from "@/components/Watches/WatchesGrid";

import { getAllProducts } from "@/services/productService";

import { Product } from "../type";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getUserLocation } from "@/lib/utils/serverutils/utils";


export default async function AllWatches() {

  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;
  const watches: Product[] = await getAllProducts();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">All Watches</h1>
      <p className="text-muted-foreground mb-8">This is the page that lists all watches.</p>
      
      <div className="flex justify-center">
        <Suspense fallback={<Spinner className="w-8 h-8"/>}>
          <WatchesGrid watches={watches} customerGeoLocation={countryCode}/>
        </Suspense>
      </div>
    </div>
  );
}