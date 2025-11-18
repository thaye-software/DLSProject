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
import { updateBrand } from "@/app/admin/masterdata/brands/actions";

export function EditBrandDialog({
  brand,
  onUpdated,
}: {
  brand: any;
  onUpdated?: (updated: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const res = await updateBrand(formData); // server action call
      const updated = res?.data ?? res;
      if (onUpdated) onUpdated(updated);
      setOpen(false);
    } catch (err) {
      console.error("Update failed", err);
      // optionally surface error to UI
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={brand.id} />
          <DialogHeader>
            <DialogTitle>Edit brand</DialogTitle>
            <DialogDescription>
              Make changes to the brand here. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="name-1">Name</Label>
              <Input id="name" name="name" defaultValue={brand.name} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                defaultValue={brand.addressLine1}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                defaultValue={brand.addressLine2}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={brand.city} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={brand.country} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="zipCode">Zip code</Label>
              <Input id="zipCode" name="zipCode" defaultValue={brand.zipCode} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="stateProvince">State/Province</Label>
              <Input
                id="stateProvince"
                name="stateProvince"
                defaultValue={brand.stateProvince}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="phoneNumber">Phone</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                defaultValue={brand.phoneNumber}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" defaultValue={brand.email} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" defaultValue={brand.website} />
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
