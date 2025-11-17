import { db } from "@/database/drizzle";
import { orderAddresses } from "@/database/schema";
import { NewOrderAddressModel, OrderAddressModel } from "@/database/types";
import { eq } from "drizzle-orm";



type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
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

export async function updateOrderAddress(id: string, newOrderAddress: Partial<OrderAddressModel>, tx?: DbTransaction) {
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