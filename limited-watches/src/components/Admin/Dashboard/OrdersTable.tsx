"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

import { formatPrice } from "@/components/Watches/Filters/ProductFilterSheet";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateOrderStatus } from "@/app/admin/action";
import { OrderStatus } from "@/app/orders/type";
import { useRouter } from "next/navigation";

type allPendingOrders = {
  id: string;
  currencyId: string;
  userId: string;
  createdAt: Date;
  status: string;
  shippingPriceDkk: string;
  shippingPriceCurrency: string;
  subTotalDkk: string;
  totalPriceDkk: string;
  totalPriceCurrency: string;
  deliveryAddressId: string | null;
  billingAddressId: string | null;
  user: {
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
  };
  orderItems: {
    id: string;
    productId: string;
    orderId: string;
    quantity: number;
    product: {
      watch: {
        model: string;
        brand: {
          name: string;
        };
      };
    };
  }[];
}[];

export default function OrdersTable({ allPendingOrders }: { allPendingOrders: allPendingOrders }) {

    const router = useRouter();

    const [allPendingOrdersState, setAllPendingOrdersState] = useState<allPendingOrders>(allPendingOrders);



    async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
        const orderToUpdate = allPendingOrdersState.find(order => order.id === orderId);
        if (!orderToUpdate) {
            toast.error("Order not found");
            return;
        }

        orderToUpdate.status = newStatus;
        setAllPendingOrdersState(previousOrders => 
            previousOrders.map(order => 
                order.id === orderId ? { ...order, status: newStatus } : order
            )
        );        

        
        
        try {
            const success = await updateOrderStatus(orderId, newStatus as any);
            if (!success) {
                toast.error("Failed to update order status");
            }
            router.refresh();

        } catch (error) {
            toast.error("An error occurred while updating order status");
        }
    }

    const ALLOWED_STATUSES: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"];

    return (
        <div className="lg:col-span-2">
            {allPendingOrdersState.length > 0 ? (

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>All Pending Orders</CardTitle>
                        <CardDescription>Latest transactions from the store</CardDescription>
                    </CardHeader>

                    <CardContent>
                        <div className="space-y-4">
                            {allPendingOrdersState.map((order) => (
                                <div key={order.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                                <div className="flex-1">
                                    {/* Customer full name */}
                                    <p className="text-sm font-medium text-foreground">
                                        {order.user.middleName ? (
                                            <span>{order.user.firstName} {order.user.middleName} {order.user.lastName}</span>
                                        ) : (
                                            <span>{order.user.firstName} {order.user.lastName}</span>
                                        )}
                                    </p>

                                    {/* order id */}
                                    <p className="text-xs text-muted-foreground">
                                        {order.id} • {order.orderItems[0].product.watch.brand.name} {order.orderItems[0].product.watch.model}
                                    </p>

                                    {/* order date */}
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatPrice(Number(order.totalPriceDkk) / 100, "DKK")}
                                    </p>

                                    {/* STATUS BADGE WITH DROPDOWN */}
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Badge
                                            variant={order.status === "DELIVERED" ? "default" : "secondary"}
                                            className={
                                                `
                                                    ${
                                                        order.status === "PENDING" ? "bg-amber-600 text-white hover:bg-amber-500" : 
                                                        order.status === "PROCESSING" ? "bg-blue-600 text-white hover:bg-blue-500" : 
                                                        order.status === "SHIPPED" ? "bg-sky-600 text-white hover:bg-sky-500" : 
                                                        order.status === "DELIVERED" ? "bg-green-600 text-white hover:bg-green-500" : 
                                                        order.status === "CANCELLED" ? "bg-red-600 text-white hover:bg-red-500" : 
                                                        order.status === "RETURNED" ? "bg-purple-600 text-white hover:bg-purple-500" : 
                                                        order.status === "REFUNDED" ? "bg-pink-600 text-white hover:bg-pink-500" : 
                                                        "bg-gray-600 text-white hover:bg-gray-500"
                                                        }
                                                hover:cursor-pointer
                                                `
                                            }
                                        >
                                            {order.status}
                                        </Badge>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent align="end">
                                        {ALLOWED_STATUSES.map((status) => (
                                        <DropdownMenuItem
                                            key={status}
                                            onClick={() => handleStatusChange(order.id, status as OrderStatus)}
                                            className="cursor-pointer"
                                        >
                                            {status}
                                        </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                    </DropdownMenu>

                                </div>
                            </div>
                        ))}
                        </div>
                    </CardContent>
                </Card>

            ) : (
                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>All Pending Orders</CardTitle>
                        <CardDescription>Latest transactions from the store</CardDescription>
                    </CardHeader>

                    <CardContent>
                        <p className="text-sm text-muted-foreground">There are no pending orders at the moment.</p>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
