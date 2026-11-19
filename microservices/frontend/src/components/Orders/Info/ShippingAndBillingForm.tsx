"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import BackButton from "@/components/Miscellaneous/BackButton";
import BillingForm from "@/components/Orders/Info/BillingForm";
import ProgressSteps from "@/components/Orders/Info/ProgressSteps";

import { submitCheckout, type CheckoutState } from "@/app/orders/actions";

export type CheckoutProduct = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  priceFormatted: string;
};

export default function ShippingAndBillingForm({ product }: { product: CheckoutProduct }) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(submitCheckout, {});
  const [sameAsBilling, setSameAsBilling] = useState(true);
  // one key per form mount: a retried submit is replayed by Orders instead of reserving twice
  const [formKey] = useState(() => crypto.randomUUID());
  const values = state.values;

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ProgressSteps currentStep={1} />
      </div>
      <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          <BackButton addClassName="mb-8" />

          <div className="grid lg:grid-cols-2 gap-8">
            <form action={formAction}>
              <input type="hidden" name="product_id" value={product.id} />
              <input type="hidden" name="idempotency_key" value={state.idempotencyKey ?? formKey} />
              <div className="space-y-8">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Billing Address</h2>
                  <BillingForm prefix="billing" values={values} />
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Checkbox
                      id="same_as_billing"
                      name="same_as_billing"
                      checked={sameAsBilling}
                      onCheckedChange={(v) => setSameAsBilling(v === true)}
                    />
                    <Label htmlFor="same_as_billing">Shipping address same as billing</Label>
                  </div>
                  {!sameAsBilling && (
                    <>
                      <h2 className="text-xl font-semibold text-foreground mb-6">Shipping Address</h2>
                      <BillingForm prefix="delivery" values={values} />
                    </>
                  )}
                </Card>
              </div>

              <Separator />

              {state.error && (
                <p role="alert" className="text-sm text-red-500 mt-4">
                  {state.error}
                </p>
              )}
              <Button className="w-full mt-6" size="lg" disabled={pending}>
                {pending ? (
                  <>
                    Proceeding to payment <Spinner />
                  </>
                ) : (
                  "Proceed to payment"
                )}
              </Button>
            </form>

            <div className="lg:sticky lg:top-8 h-fit">
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">Order Summary</h2>
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                    <Image
                      src={product.thumbnailUrl || "/sadly-no-image.png"}
                      alt={product.name}
                      fill
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{product.name}</h3>
                    <p className="text-2xl font-bold text-foreground mt-2">{product.priceFormatted}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-6">Shipping is added to the total on the next step.</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
