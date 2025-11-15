import { db } from "@/database/drizzle";
import { orderAddresses } from "@/database/schema";
import { NewOrderAddressModel, OrderAddressModel } from "@/database/types";



export async function createOrderAddress(newOrderAddress: Omit<NewOrderAddressModel, "id">): Promise<OrderAddressModel> {
    try { 
        const createdOrderAddress = await db.insert(orderAddresses).values(newOrderAddress).returning();
        return createdOrderAddress[0];

    }catch (error) {
        console.error("(server) Failed to create new entry in order address...", error);
        throw error;
    }
}
