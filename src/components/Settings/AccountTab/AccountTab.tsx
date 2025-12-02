"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";

import DeleteAccount from "./DeleteAccount";
import AccountDetails from "./AccountDetails";
import BillingForm from "@/components/Orders/Info/BillingForm";

import { getUserByEmailAction } from "@/app/actions/user";
import { getUserLocationAction } from "@/app/actions/location";

import { CustomerInfo } from "@/services/userService";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";





export default function AccountTab() {
  const router = useRouter();

  const { user, loading } = useSupabaseAuthContext(); 

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [customerGeoLocation, setCustomerGeoLocation] = useState<string>("");

  useEffect(() => {
    // we want to return early if the useSupabaseAuthContext have yet to set and fetch the user data, before user would just be null causing race condition.
    if (loading) return;

    async function getCustomerData() {
      try {
        if (!user) {
          router.push(`/login?redirect=${encodeURIComponent("/settings")}`);
          return;
        }

        const userGeoLocationData = await getUserLocationAction();
        const countryName = userGeoLocationData.country;
        setCustomerGeoLocation(countryName);
        
        const foundCustomer = await getUserByEmailAction(user.email as string);
        if (!foundCustomer) return;
        setCustomer(foundCustomer);

      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error("An unexpected error occurred");
        }
      }
    }

    getCustomerData();

  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center mt-24">
        Loading account... <Spinner />
      </div>
    ); 
  }


  return (
    <div className="container p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account information and preferences</p>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-6">

        <AccountDetails/>

        <BillingForm
          key={customer?.id ?? "loading"} // argument key, ensures that BillingForm will be mounted correctly with customer data, initially customer is null, but as soon as customer is loaded key changes forcing react to destroy and recreate passing customer data, ensuring sync data.
          customer={customer as CustomerInfo}
          customerGeoLocation={customerGeoLocation}
        />
      </div>

      <DeleteAccount/>
     
    </div>
  );
}
