import Link from "next/link";
import { CreditCard, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OrdersTable from "@/components/Admin/Dashboard/OrdersTable";
import { NotAvailable } from "@/components/NotAvailable";

import { withLoginRedirect } from "@/lib/gateway";
import { formatMoney } from "@/lib/money";
import { problemMessage } from "@/lib/problemMessage";
import { listOrders } from "@/services/orderService";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let orders;
  let error: string | null = null;
  try {
    orders = (await withLoginRedirect(() => listOrders())).items;
  } catch (e) {
    error = problemMessage(e, "Orders could not be loaded right now.", "List orders failed");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
        </div>
      </header>

      <div className="px-6 py-8">
        <h1 className="font-bold text-xl mb-4">All time analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {["Revenue", "Customers", "Products"].map((feature) => (
            <Card key={feature}>
              <CardContent>
                <NotAvailable feature={feature} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {error ? (
            <p role="alert" className="lg:col-span-2 text-sm text-red-500">
              {error}
            </p>
          ) : (
            <OrdersTable
              orders={orders!.map((o) => ({
                id: o.order_id,
                email: o.customer_email,
                summary: o.items.map((i) => `${i.product_name} x${i.quantity}`).join(", "),
                createdAt: o.created_at,
                total: formatMoney(o.totals.total),
                status: o.status,
              }))}
            />
          )}

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3">
                  <Link href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full justify-start gap-3" size="lg">
                      <CreditCard className="w-5 h-5" />
                      Stripe - Payments
                    </Button>
                  </Link>
                  <Link href="https://eu.posthog.com/" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full justify-start gap-3" size="lg">
                      <TrendingUp className="w-5 h-5" />
                      PostHog - Analytics
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
