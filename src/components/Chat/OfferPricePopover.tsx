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
import { useEffect, useState } from "react";
export function OfferPricePopover({
  product,
  sendMessage,
}: {
  product?: any;
  sendMessage?: (content: string) => Promise<void>;
}) {
  // currency toggle state
  const [currency, setCurrency] = useState<"DKK" | "EUR">("DKK");

  // price shown in the currently selected currency, as a decimal number (e.g. 1999.99)
  // product base price converted to the currently selected currency (decimal)
  // NOTE: price in DB is stored as net (without VAT). Show/offer price should be gross (net + VAT).
  // price shown in the currently selected currency, as a decimal number (gross = net * 1.25)
  const [newPrice, setNewPrice] = useState<number | undefined>(
    product ? (product.priceDkk / 100) * 1.25 : undefined
  );

  // product base price (gross) converted to the currently selected currency (decimal)
  const [basePrice, setBasePrice] = useState<number | undefined>(
    product ? (product.priceDkk / 100) * 1.25 : undefined
  );

  // VAT portion of the gross price = gross - net = gross * 0.2
  const VAT = newPrice ? newPrice * 0.2 : 0;

  // when currency changes, request a server conversion (only for EUR)
  useEffect(() => {
    if (!product) return;

    async function fetchConverted() {
      if (currency === "DKK") {
        const dkkGross = (product.priceDkk / 100) * 1.25;
        setBasePrice(dkkGross);
        setNewPrice(dkkGross);
        return;
      }

      try {
        // convert the gross price (net * 1.25) so the returned EUR amount is gross as well
        const grossCents = Math.round(product.priceDkk * 1.25);
        const res = await fetch("/api/currency/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceDkkInCents: grossCents, target: "EUR" }),
        });
        if (!res.ok) throw new Error("Conversion failed");
        const json = await res.json();
        // json.amount should be decimal price in EUR
        const eur = Number(json.amount ?? 0);
        setBasePrice(eur);
        setNewPrice(eur);
      } catch (err) {
        console.error("Failed converting currency:", err);
      }
    }

    void fetchConverted();
  }, [currency, product]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="rounded-full">
          <HandCoins className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={20} className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="leading-none font-bold">Offer price</h4>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-5 items-center gap-4">
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="price"
                  value={newPrice ?? ""}
                  className="h-8 flex-1"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === "" ? undefined : Number(raw);
                    setNewPrice(parsed);
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant={currency === "DKK" ? "default" : "ghost"}
                    size={"sm"}
                    onClick={() => setCurrency("DKK")}
                  >
                    Kr
                  </Button>
                  <Button
                    variant={currency === "EUR" ? "default" : "ghost"}
                    size={"sm"}
                    onClick={() => setCurrency("EUR")}
                    disabled={true}
                  >
                    €
                  </Button>
                </div>
              </div>
              <OfferPriceConfirmDialog
                product={product}
                newPrice={newPrice}
                currency={currency}
                basePriceInCurrency={basePrice}
                sendMessage={sendMessage}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
