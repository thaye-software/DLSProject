import Link from "next/link";
import Image from "next/image";

import AutoRefresh from "@/components/Orders/AutoRefresh";
import ProgressSteps from "@/components/Orders/Info/ProgressSteps";
import { NotAvailable } from "@/components/NotAvailable";

import { formatMoney } from "@/lib/money";
import { problemMessage } from "@/lib/problemMessage";
import { withLoginRedirect } from "@/lib/gateway";
import { getOrder } from "@/services/orderService";

export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderId } = await searchParams;
  if (!orderId) return <NotAvailable feature="This order" />;

  let order;
  try {
    order = await withLoginRedirect(() => getOrder(orderId));
  } catch (e) {
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-24 text-center text-muted-foreground">
        {problemMessage(e, "The order could not be loaded. Please try again later.", "Load order failed")}
      </div>
    );
  }

  // Stripe redirects before its webhook has reached Orders, so RESERVED means "paid, not yet confirmed".
  const processing = order.status === "RESERVED";
  const failed = order.status === "EXPIRED" || order.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      {processing && <AutoRefresh />}
      <ProgressSteps currentStep={processing ? 3 : 4} />

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mt-12 mb-2">
            {processing ? "Processing your payment..." : failed ? "Order not completed" : "Order Confirmed!"}
          </h1>
          <p className="text-muted-foreground">
            {processing
              ? "We are waiting for the payment confirmation. This page updates by itself."
              : failed
                ? `This order is ${order.status.toLowerCase()}.`
                : "Thank you for your purchase."}
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Order Details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Order #<span className="font-mono">{order.order_id}</span>
              </p>
            </div>
            <span className="px-3 py-1 bg-muted text-foreground text-xs font-semibold rounded-full">
              {order.status}
            </span>
          </div>

          {order.items.map((item) => (
            <div key={item.product_id} className="flex gap-4 pb-4 border-b">
              <div className="relative w-20 h-20 rounded-md overflow-hidden shrink-0">
                <Image
                  src={item.thumbnail_url || "/sadly-no-image.png"}
                  alt={item.product_name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{item.product_name}</p>
                <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
              </div>
            </div>
          ))}

          <div className="space-y-2 py-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(order.totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatMoney(order.totals.shipping)}</span>
            </div>
          </div>
          <div className="border-t pt-4 flex justify-between items-baseline">
            <span className="text-lg font-bold text-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">{formatMoney(order.totals.total)}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/watches"
            className="flex-1 text-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
