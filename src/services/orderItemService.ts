import { db } from "@/database/drizzle";
import { orderItems } from "@/database/schema";
import { NewOrderItemModel, OrderItemModel } from "@/database/types";



export async function createOrderItem(newOrderItem: Omit<NewOrderItemModel, "id">): Promise<OrderItemModel> {
    try {
        const createdOrderItem = await db.insert(orderItems).values(newOrderItem).returning();
        return createdOrderItem[0];

    } catch(error) {
        console.error("(server) failed to create new order item...", error);
        throw error;
    }
}
