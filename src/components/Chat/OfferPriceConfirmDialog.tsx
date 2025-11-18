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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export function OfferPriceConfirmDialog({ product, newPrice }: { product?: any, newPrice?: number }) {
  
  function calculateDiscountedPrice(originalPrice: number, newPrice: number) {
    if (originalPrice <= 0) return 0;
    const discount = ((originalPrice - newPrice) / originalPrice) * 100;
    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="rounded-full"><Check className="size-4"/></Button>
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
                {newPrice ? `New price: ${newPrice} Dkk/Eur (currency to be implemented)` : ""}
              </span>
              <span className="font-bold text-foreground">
                {product && newPrice ? `Discount: ${calculateDiscountedPrice(product.priceDkk, newPrice)}%` : ""}
              </span>
            </div>

          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
