"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

import { softDeleteAccountAction } from "@/app/settings/actions";
import { Spinner } from "@/components/ui/spinner";

export default function DeleteAccount() {
  const router = useRouter();
  const { user, deleteLocalData } = useSupabaseAuthContext();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);



  async function handleDelete() {
    if (confirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    
    try {
        setIsDeleting(true);

        const success = await softDeleteAccountAction(user?.id as string);
        if (success) {
            deleteLocalData();
            
            toast.success("Your account has been successfully deleted");
            setIsDialogOpen(false);
            router.push("/");
        }

    } catch (error) {
        if (error instanceof Error) {
            toast.error(error.message);

        } else {
            toast.error("An unexpected error occurred");
        }

    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancel() {
    setIsDialogOpen(false);
    setConfirmText("");
  }

  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Delete your account</CardTitle>
          </div>
          <CardDescription>
            This is irreversible and all data will be lost forever.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Button 
              variant="destructive" 
              onClick={() => setIsDialogOpen(true)}
            >
              Delete Account
            </Button>

        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-xl">You are about to delete your Account</DialogTitle>
            </div>
            <DialogDescription className="text-base pt-2">
              This action cannot be undone. This will permanently delete your account
              and remove all data from our servers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-sm font-medium">
                Type <span className="font-bold text-destructive">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="border-destructive/50 focus-visible:ring-destructive"
                disabled={isDeleting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
                className="mr-2"
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isDeleting}
            >
                Cancel
            </Button>

            <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || isDeleting}
                >
                {isDeleting ? (
                    <div className="flex gap-2 items-center">
                        Deleting... <Spinner/>
                    </div> 
                ) : (
                    "I understand, delete my account"
                    )
                }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}