"use client"

import {Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import DeleteAccount from "./DeleteAccount";
import AccountDetails from "./AccountDetails";





export default function AccountTab() {

  return (
    <div className="container p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account information and preferences</p>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-6">

        <AccountDetails/>

{/* TODO replace with billing infomation */}
        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your password and account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" placeholder="Enter current password" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="Enter new password" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" placeholder="Confirm new password" />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Update Password</Button>
          </CardFooter>
        </Card>
      </div>

      <DeleteAccount/>
     
    </div>
  );
}
