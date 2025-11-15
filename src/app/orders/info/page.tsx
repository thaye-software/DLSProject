import { SearchParams } from "next/dist/server/request/search-params";
import { redirect } from "next/navigation";

import BackButton from "@/components/BackButton";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";
import ToastWrapper from "@/components/Toast/ToastWrapper";

import { userService } from "@/services/userService";

import { getSignedInUser, getUserLocation } from "@/lib/utils/serverutils/utils";




export default async function OrdersInfoPage({searchParams}: {searchParams: SearchParams}) {
  const userGeoLocationData = await getUserLocation();
  const countryCode = userGeoLocationData.countryCode;

  const productSlug = (await searchParams).product;
  let state = { success: true, message: "", redirectUrl: "" };
	const { data: { user }, error } = await getSignedInUser();
	
	if(!user) {
		redirect(`/login?redirect=${encodeURIComponent("/orders/info")}`);
	}

  const customer = await userService.getCostumerInfoByEmail(user.email as string)
  if (!customer) {
    state.message = "Something went wrong when signing in, try again later..."
    state.redirectUrl = "/"
  }
  
  console.log(customer)
	return(
    <div>
      {customer ? (
        <div>
          <BackButton/>
          <ShippingAndBillingForm customer={customer} productSlug={productSlug as string} customerGeoLocation={countryCode}/>
        </div>
      ) : (
        <ToastWrapper state={state}/>
      )}
    </div>
	);
}