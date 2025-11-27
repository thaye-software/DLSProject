import { redirect } from "next/navigation";
import { SearchParams } from "next/dist/server/request/search-params";

import ToastWrapper from "@/components/Toast/ToastWrapper";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";

import { getCustomerInfoByEmail } from "@/services/userService";

import { getSignedInUser, getUserLocation } from "@/lib/utils/server/utils";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { verifyOfferToken } from "@/services/offerService";

export default async function OrdersInfoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;

  const resolvedSearchParams = await searchParams;
  const productSlug = resolvedSearchParams.product as string;
  const offerToken = resolvedSearchParams.offer as string | undefined;

  let discountedPrice: number | undefined;

  if (offerToken) {
    const offer = await verifyOfferToken(offerToken);
    if (offer && offer.productSlug === productSlug) {
      discountedPrice = offer.priceDkk;
    }
  }

  let state = { success: true, message: "", redirectUrl: "" };
  const {
    data: { user },
    error,
  } = await getSignedInUser();

  if (!user) {
    redirect(
      `/login?redirect=${encodeURIComponent(
        `/orders/checkout/infomation?product=${productSlug}`
      )}`
    );
  }

  const customer = await getCustomerInfoByEmail(user.email as string);
  if (!customer) {
    state.message = "Something went wrong when signing in, try again later...";
    state.redirectUrl = "/";
  }

  return (
    <div>
      {customer ? (
        <Suspense
          fallback={
            <div>
              Loading... <Spinner />{" "}
            </div>
          }
        >
          <ShippingAndBillingForm
            customer={customer}
            productSlug={productSlug as string}
            customerGeoLocation={countryCode}
            discountedPrice={discountedPrice}
            offerToken={offerToken}
          />
        </Suspense>
      ) : (
        <ToastWrapper state={state} />
      )}
    </div>
  );
}
