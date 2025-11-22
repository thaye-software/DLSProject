import { Spinner } from "@/components/ui/spinner";
import { WatchesGrid } from "@/components/Watches/WatchesGrid";
import { Suspense } from "react";
import { getAuthUser, getUserLocation } from "@/lib/utils/server/utils";
import { getFavoritedProductsByUserId, getUserFavorites } from "@/services/favoriteService";
import { redirect } from "next/navigation";

export default async function WatchlistPage() {
  const { user } = await getAuthUser();
  if (!user) {
    redirect("/");
  }
  const watches = await getUserFavorites(user.id);
  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Your Watchlist</h1>
      <div className="flex justify-center mt-10">
        {watches && watches.length > 0 ? (
          <Suspense fallback={<Spinner className="w-8 h-8" />}>
            <WatchesGrid
              watches={watches}
              customerGeoLocation={countryCode}
              removeOnFavorite={true}
            />
          </Suspense>
        ) : (
          <div className="flex justify-center items-center py-20 text-gray-500 text-lg font-medium">
            <span>No favorites yet.</span>
            <br></br>
            <span>
              <a href="/watches" className="text-blue-500 underline">
                Explore our collection
              </a>{" "}
              and add your favorite watches!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
