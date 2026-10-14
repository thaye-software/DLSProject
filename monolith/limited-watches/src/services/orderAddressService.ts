import { db, DbTransaction } from "@/database/drizzle";
import { orderAddresses, orders } from "@/database/schema";
import { NewOrderAddressModel, OrderAddressModel } from "@/database/types";
import { eq, inArray } from "drizzle-orm";




export async function createOrderAddress(newOrderAddress: Omit<NewOrderAddressModel, "id">, tx?: DbTransaction): Promise<OrderAddressModel> {
    try { 
        const dbContext = tx || db;
        const createdOrderAddress = await dbContext.insert(orderAddresses).values(newOrderAddress).returning();
        return createdOrderAddress[0];

    }catch (error) {
        console.error("(server) Failed to create new entry in order address...", error);
        throw error;
    }
}






export async function updateOrderAddress(id: string, newOrderAddress: Partial<OrderAddressModel>, tx?: DbTransaction): Promise<OrderAddressModel> {
    try {
        const dbContext = tx || db;

        const { id: _, ...safeUpdates } = newOrderAddress;

        const updatedOrderAddress = await dbContext
            .update(orderAddresses)
            .set(safeUpdates)
            .where(eq(orderAddresses.id, id))
            .returning();

        if (!updatedOrderAddress[0]) {
            throw new Error(`Order address with id ${id} not found`);
        }

        return updatedOrderAddress[0];

    } catch (error) {
        console.error(`(server) failed to update order address`, error);
        throw error;
    }
}






export async function deleteOrderAddresses(userId: string, tx?: DbTransaction) {
  try {
    const dbContext = tx || db;
    const userOrders = await dbContext.query.orders.findMany({
      where: eq(orders.userId, userId),
      columns: {
        deliveryAddressId: true,
        billingAddressId: true,
      },
    });

    if (userOrders.length === 0) {
      return;
    }

 

    const addressIds = new Set<string>();
    userOrders.forEach((order) => {
      if (order.deliveryAddressId) {
        addressIds.add(order.deliveryAddressId);
      }
      if (order.billingAddressId) {
        addressIds.add(order.billingAddressId);
      }
    });

    const addressIdsArray = Array.from(addressIds);
    if (addressIdsArray.length === 0) {
      return;
    }


    
    const deletedAddresses = await db
      .delete(orderAddresses)
      .where(inArray(orderAddresses.id, addressIdsArray))
      .returning();

    return deletedAddresses;

  } catch (error) {
    console.error(`Failed to delete order addresses for user ${userId}:`, error);
    throw error;
  }
}
