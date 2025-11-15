import { db } from "@/database/drizzle";
import { orderAddresses } from "@/database/schema";
import { NewOrderAddressModel, OrderAddressModel } from "@/database/types";



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
