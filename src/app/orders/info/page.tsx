import BackButton from "@/components/BackButton";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";
import { getSignedInUser } from "@/lib/utils/serverutils/utils";
import { redirect } from "next/navigation";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { userService } from "@/services/userService";
import ToastWrapper from "@/components/Toast/ToastWrapper";


export default async function OrdersInfoPage() {

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
          <ShippingAndBillingForm customer={customer}/>
        </div>
      ) : (
        <ToastWrapper state={state}/>
      )}
    </div>
	);
}