import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Euro, HandCoins } from "lucide-react";
import { OfferPriceConfirmDialog } from "./OfferPriceConfirmDialog";
import { useState } from "react";

export function OfferPricePopover({ product }: { product?: any }) {

  const [newPrice, setNewPrice] = useState(product ? product.priceDkk : undefined);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="rounded-full">
          <HandCoins className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={20}
        className="w-80"
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="leading-none font-bold">Offer price</h4>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-5 items-center gap-4">
              <Input
                id="price"
                defaultValue={product ? product.priceDkk : ""}
                className="col-span-3 h-8"
                onChange={(e) => setNewPrice(Number(e.target.value))}
              />
              <span>Kr / &euro;</span>
              <OfferPriceConfirmDialog product={product} newPrice={newPrice} />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
