import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CancelOrderButton from "@/components/Orders/CancelOrderButton";

import { withLoginRedirect } from "@/lib/gateway";
import { formatMoney } from "@/lib/money";
import { problemMessage } from "@/lib/problemMessage";
import { listOrders } from "@/services/orderService";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  let orders;
  let error: string | null = null;
  try {
    orders = (await withLoginRedirect(() => listOrders())).items;
  } catch (e) {
    error = problemMessage(e, "Your orders could not be loaded right now.", "List my orders failed");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>My orders</CardTitle>
          <CardDescription>Your order history</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          ) : orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.order_id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {order.items.map((i) => i.product_name).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()} • {order.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-foreground">{formatMoney(order.totals.total)}</p>
                    {/* Orders only lets a customer cancel an unpaid (RESERVED) order */}
                    {order.status === "RESERVED" && <CancelOrderButton orderId={order.order_id} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You have no orders yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
