import { redirect } from "next/navigation";
import { SearchParams } from "next/dist/server/request/search-params";

import ToastWrapper from "@/components/Toast/ToastWrapper";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";

import { getCustomerInfoByEmail } from "@/services/userService";

import { getAuthUser, getUserLocation } from "@/lib/utils/server/utils";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";

export default async function OrdersInfoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;

  const productSlug = (await searchParams).product;
  let state = { success: true, message: "", redirectUrl: "" };
  const { user } = await getAuthUser();

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
          />
        </Suspense>
      ) : (
        <ToastWrapper state={state} />
      )}
    </div>
  );
}
