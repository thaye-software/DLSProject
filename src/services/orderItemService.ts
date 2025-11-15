import { db } from "@/database/drizzle";
import { orderItems } from "@/database/schema";
import { NewOrderItemModel, OrderItemModel } from "@/database/types";


type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function createOrderItem(newOrderItem: Omit<NewOrderItemModel, "id">, tx?: DbTransaction): Promise<OrderItemModel> {
    try {
        const dbContext = tx || db;
        const createdOrderItem = await dbContext.insert(orderItems).values(newOrderItem).returning();
        return createdOrderItem[0];

    } catch(error) {
        console.error("(server) failed to create new order item...", error);
        throw error;
    }
}
