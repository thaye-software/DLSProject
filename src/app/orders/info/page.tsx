import BackButton from "@/components/BackButton";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";
import UserGateway from "@/components/Orders/Info/UserGateway";
import { getSignedInUser } from "@/lib/utils/serverutils/utils";
import { redirect } from "next/navigation";



export default async function OrdersInfoPage() {

	const { data: { user }, error } = await getSignedInUser();
	
	if(!user) {
		redirect(`/login?redirect=${encodeURIComponent("/orders/info")}`);
	}

	return(
		<div>
			<BackButton/>
			<ShippingAndBillingForm />
		</div>
	);
}