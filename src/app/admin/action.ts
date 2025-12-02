"use server"

import { changeOrderStatus } from "@/services/orderService";
import { OrderStatus } from "../orders/type";

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    try {
        const updatedOrder = await changeOrderStatus(orderId, newStatus);
        return updatedOrder;

    } catch (error) {
        console.error(`(server) failed to update order status for order id: ${orderId}`, error);
        throw error;
    }
}
