"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import {Trash2, AlertTriangle } from "lucide-react";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

import { softDeleteAccountAction } from "@/app/settings/actions";






export default function DeleteAccount() {

    const router = useRouter();
    const { user } = useSupabaseAuthContext();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);



    async function handleDelete() {
        console.log("delete called");
        try {
            const success = await softDeleteAccountAction(user?.id as string)
            if(success) {
                toast.success("Your account has been successfully deleted");
                router.push("/");
            }


        }catch(error) {
            if (error instanceof Error) {
                toast.error(error.message);
                
            } else {
                toast.error("An unexpected error occurred");
            }
        }
    }



    return(
        <Card className="border-destructive">
            <CardHeader>
            <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription>Irreversible actions that affect your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {!showDeleteConfirm ? (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                    <h4 className="font-medium">Delete Account</h4>
                    <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>Delete Account</Button>
                </div>
            ) : (
                <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    <div className="space-y-4">
                    <div>
                        <p className="font-medium mb-2">Are you absolutely sure?</p>
                        <p className="text-sm">This action cannot be undone. This will permanently delete your account and remove all data from our servers.</p>
                    </div>
                    <div className="grid gap-3">
                        <Label htmlFor="delete-confirm">Type "DELETE" to confirm</Label>
                        <Input id="delete-confirm" placeholder="DELETE" />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={handleDelete}>I understand, delete my account</Button>
                        <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                    </div>
                    </div>
                </AlertDescription>
                </Alert>
            )}
            </CardContent>
        </Card>
    );
}