"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createNewBrand,
  updateBrand,
} from "@/app/admin/masterdata/brands/actions";

export function AddBrandDialog({
  onCreated,
}: {
  onCreated?: (created: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const res = await createNewBrand(formData); // server action call
      const created = res;
      if (onCreated) onCreated(created);
      setOpen(false);
    } catch (err) {
      console.error("Create failed", err);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add brand</DialogTitle>
            <DialogDescription>
              Add a new brand to the database. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="name-1">Name</Label>
              <Input id="name" name="name" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input id="addressLine1" name="addressLine1" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input id="addressLine2" name="addressLine2" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="zipCode">Zip code</Label>
              <Input id="zipCode" name="zipCode" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="stateProvince">State/Province</Label>
              <Input id="stateProvince" name="stateProvince" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="phoneNumber">Phone</Label>
              <Input id="phoneNumber" name="phoneNumber" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
