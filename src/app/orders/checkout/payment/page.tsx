import CheckoutForm from "@/components/Stripe/Checkout";
import { stripe } from "@/lib/stripe/stripe";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ProgressSteps from "@/components/Orders/Info/ProgressSteps";

import { getOrderItemByOrderId } from "@/services/orderItemService";
import {
  getLocalCurrencyString,
  convertCurrency,
  convertCurrencyReturnCents,
} from "@/services/currencyService";
import { convertEuroToDkk } from "@/app/orders/actions";
import constants from "@/lib/constants";
import getCountryByName from "@/services/countryService";
import Image from "next/image";

import ToastWrapper from "@/components/Toast/ToastWrapper";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import BackButton from "@/components/BackButton";
import { calculateVAT } from "@/lib/priceUtils";
import { redirect } from 'next/navigation'

//view all transaction at this link: https://dashboard.stripe.com/acct_1SKHlN6xjyBvX39o/test/payments
export default async function PaymentPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const { orderId } = await searchParams;
  if (!orderId) {
    return (
      <div>
        <ToastWrapper
          state={{
            message: "Something went wrong no order id detected...",
            success: false,
            redirectUrl: "/",
          }}
        />
      </div>
    );
  }
  const foundOrderItem = await getOrderItemByOrderId(orderId);
  if (!foundOrderItem) {
    return (
      <div>
        <ToastWrapper
          state={{
            message: `Something went wrong no order item found for order: ${orderId}...`,
            success: false,
            redirectUrl: "/",
          }}
        />
      </div>
    );
  }


  // ensure customer cant go back to payment/checkout page/site 
  if(foundOrderItem.order.status !== "RESERVED") {
    redirect("/watches");
  }


  

  const productImageSrc = foundOrderItem?.product.productImages[0].imageUrl;
  const productName =
    foundOrderItem?.product.watch.brand.name +
    " " +
    foundOrderItem?.product.watch.model;

  const itemAmount = parseFloat(foundOrderItem?.order.subTotalDkk || "0");
  // Prefer the billing country stored on the order (keeps display consistent with checkout),
  const billingCountryName = foundOrderItem?.order.billingAddress?.country;
  const deliveryCountryName = foundOrderItem?.order.deliveryAddress?.country;

  let countryCode = undefined;
  let billingCountry = null;
  let deliveryCountry = null;

  if (billingCountryName) {
    billingCountry = await getCountryByName(billingCountryName);
    countryCode = billingCountry?.abbreviation;
  }
  if (!countryCode && deliveryCountryName) {
    deliveryCountry = await getCountryByName(deliveryCountryName);
    countryCode = deliveryCountry?.abbreviation;
  }

  const subtotal = itemAmount;
  // Get the subtotal amount in local currency format
  const subtotalFormatted = await getLocalCurrencyString(
    itemAmount,
    countryCode as string
  );
  

  const shippingDkkCents = constants.SHIPPING_PRICE_DKK * 100;
  const shippingEurCents = constants.SHIPPING_PRICE_EUR * 100;

  console.log("subtotal before shipping:", subtotal);
  let subtotalEur = await convertCurrencyReturnCents(subtotal, countryCode as string);
  console.log("subtotalEur:", subtotalEur);
  let total = null;
  if (countryCode === "DK") {
    total = subtotal + shippingDkkCents;
  } else {
    total = (subtotalEur + shippingEurCents);
    console.log(total)
  }

  let displayTotalAmount;
  if (
    (countryCode as string).toUpperCase() === "DK"
  ) {
    displayTotalAmount = new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
    }).format(total / 100);
  } else {
    displayTotalAmount = new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(total / 100);
  }
  // Use the _flat_ shipping price (50 EUR) as the ground truth for display — this keeps the payment page consistent and explicit about the flat-rate.

  const displayShippingAmount =
    (countryCode as string).toUpperCase() === "DK"
      ? new Intl.NumberFormat("da-DK", {
          style: "currency",
          currency: "DKK",
        }).format(constants.SHIPPING_PRICE_DKK)
      : new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
        }).format(constants.SHIPPING_PRICE_EUR);

  // Charge the buyer the gross total (product net + VAT + shipping)
  const stripeAmountToBePaid = countryCode === "DK" ? Number(total / 100) : Number(total * 100);
  if (!stripe) throw new Error("Stripe not available");
  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeAmountToBePaid,
    currency: countryCode === "DK" ? "dkk" : "eur",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      internal_order_id: orderId
    }
  })

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ProgressSteps currentStep={2} />
      </div>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
        <BackButton addClassName="mb-8" />

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Payment Form */}
          <div className="space-y-6">
            <Suspense
              fallback={
                <div>
                  Loading... <Spinner />{" "}
                </div>
              }
            >
              <CheckoutForm
                clientSecret={paymentIntent.client_secret!}
                orderId={orderId}
              />
            </Suspense>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                Order Summary
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 relative">
                    <Image
                      src={productImageSrc || ""}
                      alt={productName}
                      fill
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground">
                      {productName}
                    </h3>
                    <p className="text-md font-bold text-foreground mt-2">
                      {subtotalFormatted}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{subtotalFormatted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <div className="flex flex-col items-end">
                      <span className="text-foreground">
                        {displayShippingAmount}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">{displayTotalAmount}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
