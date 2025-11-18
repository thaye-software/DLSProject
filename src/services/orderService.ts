import { db } from "@/database/drizzle";
import { orders } from "@/database/schema";
import { NewOrderModel, NewOrderAddressModel } from "@/database/types";

import { createOrderAddress, updateOrderAddress } from "./orderAddressService";
import { getProductById, updateProductStock } from "./productService";
import { createOrderItem } from "./orderItemService";
import { eq, desc } from "drizzle-orm";



export async function createOrder(
    orderDetails: Omit<NewOrderModel, "id">,
    newBillingAddress: Omit<NewOrderAddressModel, "id">,
    newShippingAddress?: Omit<NewOrderAddressModel, "id">
) {

    try{

        const result = await db.transaction(async (tx) => {

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            const userNewestOrder = await getNewestOrder(tx);

            // If the newest order was created less than 5 minutes ago, return early
            if (userNewestOrder && userNewestOrder.createdAt > fiveMinutesAgo && userNewestOrder.status === "PROCESSING") {
            
                if(newShippingAddress) {
                    await updateOrderAddress(userNewestOrder.deliveryAddress?.id as string, newShippingAddress, tx);
                }
                await updateOrderAddress(userNewestOrder.billingAddress?.id as string, newBillingAddress, tx);
                
                return userNewestOrder.id;
            }
            



            let shippingAddressId;
            if(newShippingAddress) {
                const createdShippingAddress = await createOrderAddress(newShippingAddress, tx);
                shippingAddressId = createdShippingAddress.id;
            }
            const createdBillingAddress = await createOrderAddress(newBillingAddress, tx);
            const billingAddressesId = createdBillingAddress.id;
            
            // deæoveryAddress is the same as shipping address
            orderDetails.deliveryAddressId = shippingAddressId;
            orderDetails.billingAddressId = billingAddressesId;
            const createdOrder = await tx.insert(orders).values(orderDetails).returning();
            const orderId = createdOrder[0].id;

            //@ts-ignore
            const product = await getProductById(orderDetails.productId, tx);
            //@ts-ignore
            if(!product) throw new Error(`(server) could not find product with id: ${orderDetails.productId}`);
            if(product.stock === 0 ) throw new Error(`(Server) ${product.name} with id: ${product.id} is out of stock`);
            if(product.stock < 0) throw new Error(`(Server) hmm, something seems ood ${product.name} with id: ${product.id} has negative stock value`);

            // hardcoded 1 since requirment that customer can only buy one watch at a time.
            await updateProductStock(product.id, product.stock-1, tx);

            const orderItem = {
                orderId, 
                productId: product.id, 
                quantity: 1
            }

            await createOrderItem(orderItem, tx);

            return orderId;
        });

        return result

    } catch(error) {
        console.error("(server) failed creating new order...", error);
        throw error;
    }
}



//--------------------------------------- helper functions --------------------------------------- 
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function getNewestOrder( tx?: DbTransaction) {
    const dbContext = tx || db;
    const newestOrder = await dbContext
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(1);

    if(!newestOrder[0]) {
        return null;
    }

    const newestOrderWithOrderAddresses = await dbContext.query.orders.findFirst({
            where: eq(orders.id, newestOrder[0].id),
            columns: { 
                id: true,
                createdAt: true,
                status: true
            },
            with: {
                billingAddress: true,
                deliveryAddress: true
            }
        });
    return newestOrderWithOrderAddresses;
}