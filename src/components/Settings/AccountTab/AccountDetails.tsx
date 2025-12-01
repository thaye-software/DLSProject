"use client"

import { useEffect, useState } from "react";
import { User, MailWarning } from "lucide-react";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import ChangeAvatar from "./ChangeAvatar";

import { changeUsernameAndEmail } from "@/app/settings/actions";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";



export default function AccountDetails() {

    const [isPendingEmailConfirmation, setIsPendingEmailConfirmation] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    const { user, refreshUser } = useSupabaseAuthContext();



    useEffect(() => {
        const isEmailConfirmed = user?.email_confirmed_at;
        setIsPendingEmailConfirmation(!isEmailConfirmed);
        
    }, [isPendingEmailConfirmation, user])

  
    async function handleInfoChange(event: any) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const data = Object.fromEntries(formData.entries());
        
        try {
            //@ts-ignore
            const {isUsernameChanged, isEmailedChangeInitiated, userNotFound} = await changeUsernameAndEmail(data);
            
            if(userNotFound) {
                toast.error("Unexpted error no user found, try again later");
                return;
            }
            
            if(!isEmailedChangeInitiated && !isUsernameChanged) {
                toast.error("Nothing changed");
                return;
            }
            
            if(isUsernameChanged) {
                await refreshUser()
            }
            sendSuccessfulToast(isUsernameChanged as boolean, isEmailedChangeInitiated as boolean);
            setIsPendingEmailConfirmation(isEmailedChangeInitiated as boolean);
            
        } catch(error: any) {
            console.error("unexpedted error occoured during username/email change",error);
            toast.error(error.message as string);

        } finally {
            setIsLoading(false);
        }
        

    }

    return(
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Upload */}

            <ChangeAvatar/>

            <Separator />

            {/* Username */}
            <form onSubmit={handleInfoChange}>

              <div className="grid gap-3 mb-8">
                <Label htmlFor="newUsername">Username</Label>
                <span className="text-xs text-muted-foreground">This is your display name.</span>
                <Input id="newUsername" name="newUsername" defaultValue={user?.user_metadata.display_name} placeholder="Enter your username" />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="newEmail">Email</Label>
                {isPendingEmailConfirmation && (
                  <span className="flex items-center gap-2 text-xs text-yellow-500">
                    <MailWarning size={18}/>
                    Email verification pending
                  </span>
                )}
                <Input id="newEmail" type="email" name="newEmail" defaultValue={user?.email} />
              </div>

              <Input defaultValue={user?.id} name="customerId" hidden/>

              <Button className="mt-8 hover:curser-pointer" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex gap-2">
                    Changing...
                    <Spinner/> 
                  </div>
                  
                  ) : (
                    <div>Confirm changes</div>
                  )}
              </Button>

            </form>
          </CardContent>
        </Card>
    )
}

//--------------------------------- helper function ---------------------------------

function sendSuccessfulToast(isUsernameChanged: boolean, isEmailedChangeInitiated: boolean) {
  if(isUsernameChanged && isEmailedChangeInitiated) {
    toast.success("Username was successfully changed, and a new email confirmation has been sent to your new email");
    return;
  }

  if(isUsernameChanged) {
    toast.success("Username was successfully changed!");
    return;
  }

  if(isEmailedChangeInitiated) {
    toast.success("A new email confirmation has been sent to your new email");
    return;
  }
}