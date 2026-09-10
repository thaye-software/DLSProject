"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

// no local state required here

import { generateOfferLink } from "@/app/orders/offer-actions";

export function OfferPriceConfirmDialog({
  product,
  newPrice,
  currency = "DKK",
  basePriceInCurrency,
  sendMessage,
}: {
  product?: any;
  newPrice?: number;
  currency?: "DKK" | "EUR";
  basePriceInCurrency?: number;
  sendMessage?: (content: string) => Promise<void>;
}) {
  function calculateDiscountedPrice(originalPrice: number, newPrice: number) {
    if (!originalPrice || originalPrice <= 0) return 0;
    if (!newPrice) return 0;
    const discount = ((originalPrice - newPrice) / originalPrice) * 100;
    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="rounded-full">
          <Check className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Offer new price?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="flex flex-col gap-2">
              <span>
                Are you sure you want to offer this new price to the customer?
              </span>
              <span className="font-bold text-foreground">
                {newPrice
                  ? `New price: ${newPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${currency}`
                  : ""}
              </span>
              <span className="font-bold text-foreground">
                {product && newPrice
                  ? `Discount: ${calculateDiscountedPrice(
                      basePriceInCurrency ?? (product.priceDkk / 100) * 1.25,
                      newPrice
                    )}%`
                  : ""}
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="cursor-pointer"
            onClick={async () => {
              try {
                if (!newPrice) return;

                const productSlug =
                  product?.watch?.slug ?? product?.slug ?? product?.id ?? "";

                // Generate secure offer link
                const checkoutUrl = await generateOfferLink(
                  productSlug,
                  newPrice,
                  currency
                );

                const content = `I can offer this price: ${newPrice.toLocaleString(
                  undefined,
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )} ${currency}. Checkout: ${checkoutUrl}`;

                if (sendMessage) {
                  await sendMessage(content);
                }
              } catch (err) {
                console.error("Failed to send offer message:", err);
              }
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
