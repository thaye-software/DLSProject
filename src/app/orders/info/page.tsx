import { Navbar } from "@/components/navbar/Navbar";
import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";
import UserGateway from "@/components/Orders/Info/UserGateway";
import { getSignedInUser } from "@/lib/utils/serverutils/utils";



export default async function OrdersInfoPage() {

    const { data: { user }, error } = await getSignedInUser();
    
    if(user) {
        
    }

    return(
        <div>
            {user ? (
                <div>
                    <ShippingAndBillingForm />
                </div>
            ) : (
                <UserGateway redirectUrl="/orders/info"/>
            )}
        </div>
    );
}