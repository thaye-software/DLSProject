"use client"

import {Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import DeleteAccount from "./DeleteAccount";
import AccountDetails from "./AccountDetails";
import BillingForm from "@/components/Orders/Info/BillingForm";
import { useEffect, useState } from "react";
import { CustomerInfo } from "@/services/userService";
import { getUserLocationAction } from "@/app/actions/location";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { getUserByEmailAction, getUserByIdAction } from "@/app/actions/user";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";





export default function AccountTab() {
  const router = useRouter();

  // 1. Get the loading state from your hook
  const { user, loading } = useSupabaseAuthContext(); 

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [customerGeoLocation, setCustomerGeoLocation] = useState<string>("");

  useEffect(() => {
    // 2. If auth is still loading, DO NOTHING. Return early.
    if (loading) return;

    async function getCustomerData() {
      try {
        // 3. Now that loading is false, if user is STILL null, then redirect.
        if (!user) {
          router.push(`/login?redirect=${encodeURIComponent("/settings")}`);
          return;
        }

        const userGeoLocationData = await getUserLocationAction();
        const countryName = userGeoLocationData.country;
        setCustomerGeoLocation(countryName);
        
        // user.email is now safe to access because we passed the checks above
        const foundCustomer = await getUserByEmailAction(user.email as string);
        console.log("asdasd",foundCustomer)
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

  }, [user, loading, router]); // 4. Add isLoading to dependency array

  // Optional: Return a spinner while loading so the UI doesn't flash empty
  if (loading) {
    return <div>Loading account... <Spinner/> </div>; 
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
          key={customer?.id ?? "loading"}
          customer={customer as CustomerInfo}
          customerGeoLocation={customerGeoLocation}
        />
      </div>

      <DeleteAccount/>
     
    </div>
  );
}
