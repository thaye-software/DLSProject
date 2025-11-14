import BackButton from "@/components/BackButton";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";
import { getSignedInUser } from "@/lib/utils/serverutils/utils";
import { redirect } from "next/navigation";
import { userService } from "@/services/userService";
import ToastWrapper from "@/components/Toast/ToastWrapper";
import { SearchParams } from "next/dist/server/request/search-params";


export default async function OrdersInfoPage({searchParams}: {searchParams: SearchParams}) {

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
          <ShippingAndBillingForm customer={customer} productSlug={productSlug as string}/>
        </div>
      ) : (
        <ToastWrapper state={state}/>
      )}
    </div>
	);
}