import Image from "next/image";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import CheckoutForm from "@/components/Stripe/Checkout";
import BackButton from "@/components/Miscellaneous/BackButton";
import ProgressSteps from "@/components/Orders/Info/ProgressSteps";
import { NotAvailable } from "@/components/NotAvailable";

import { formatMoney } from "@/lib/money";
import { problemMessage } from "@/lib/problemMessage";
import { withLoginRedirect } from "@/lib/gateway";
import { getOrder } from "@/services/orderService";
import { createPayment } from "@/services/paymentService";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderId } = await searchParams;
  if (!orderId) return <NotAvailable feature="This order" />;

  const failed = (e: unknown) => (
    <div role="alert" className="mx-auto max-w-xl px-4 py-24 text-center text-muted-foreground">
      {problemMessage(e, "Payment could not be started. Please try again later.", "Start payment failed")}
    </div>
  );

  let order;
  try {
    order = await withLoginRedirect(() => getOrder(orderId));
  } catch (e) {
    return failed(e);
  }
  // already paid or expired: don't open a payment for it
  if (order.status !== "RESERVED") redirect(`/orders/checkout/success?order=${encodeURIComponent(orderId)}`);

  let session;
  try {
    session = await withLoginRedirect(() => createPayment(orderId));
  } catch (e) {
    return failed(e);
  }

  const item = order.items[0];
  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ProgressSteps currentStep={2} />
      </div>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
        <BackButton addClassName="mb-8" />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <CheckoutForm clientSecret={session.client_secret} orderId={orderId} />
          </div>

          <div className="lg:sticky lg:top-8 h-fit">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Order Summary</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 relative">
                    <Image
                      src={item.thumbnail_url || "/sadly-no-image.png"}
                      alt={item.product_name}
                      fill
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{item.product_name}</h3>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(order.totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{formatMoney(order.totals.shipping)}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(order.totals.total)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
