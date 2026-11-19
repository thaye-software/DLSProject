"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrderStatus } from "@/app/admin/action";

export type AdminOrder = {
  id: string;
  email: string;
  summary: string;
  createdAt: string;
  total: string;
  status: string;
};

// What an admin may set; Orders rejects invalid transitions with a 409 that is shown as a toast.
const ADMIN_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"] as const;
type AdminStatus = (typeof ADMIN_STATUSES)[number];

export default function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  async function handleStatusChange(orderId: string, status: AdminStatus) {
    setBusy(orderId);
    const error = await updateOrderStatus(orderId, status);
    setBusy(null);
    if (error) toast.error(error);
    startTransition(() => router.refresh());
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>Latest transactions from the store</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no orders at the moment.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{order.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.id} • {order.summary}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-foreground">{order.total}</p>
                  <select
                    aria-label={`Status of order ${order.id}`}
                    value={order.status}
                    disabled={busy === order.id}
                    onChange={(e) => handleStatusChange(order.id, e.target.value as AdminStatus)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {/* the current status may be a system one (RESERVED, PENDING...) */}
                    {!ADMIN_STATUSES.includes(order.status as AdminStatus) && (
                      <option value={order.status} disabled>
                        {order.status}
                      </option>
                    )}
                    {ADMIN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
