import { eq, and, inArray, asc } from "drizzle-orm";

import { db, DbTransaction } from "@/database/drizzle";
import { orderItems, orders, users } from "@/database/schema";
import { NewOrderModel, NewOrderAddressModel } from "@/database/types";

import { createOrderItem } from "./orderItemService";
import { checkAndUpdateProductStock, getProductById, updateProductStock } from "./productService";
import { createOrderAddress, updateOrderAddress } from "./orderAddressService";

import { OrderDetails } from "@/app/orders/actions";
import { getLocalCurrencyString } from "./currencyService";
import { OrderStatus } from "@/app/orders/type";






export async function getAllTimeRevenueDkk() {
  try {
    const allOrders = await db.query.orders.findMany({
      where: eq(orders.status, "DELIVERED"),
    });

    const allTimeRevenueDkk = allOrders.reduce((total, order) => {
      return total + parseFloat(order.totalPriceDkk);
    }, 0);

    const formattedRevenue = getLocalCurrencyString(allTimeRevenueDkk, "DKK");
    return formattedRevenue;

  } catch (error) {
    console.error("(server) failed to retrieve all time revenue", error);
    throw error;  
  }
}

export async function getAllPendingOrders() {
  try {
    const pendingOrders = await db.query.orders.findMany({
      where: inArray(orders.status, ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "RETURNED", "REFUNDED"]),
      orderBy: [asc(orders.createdAt)],

      with: {
        user: {
          columns: {
            firstName: true,
            middleName: true,
            lastName: true,
          }
        },

        orderItems: {
          with: {
            product: {
              columns: {},
              with: {
                watch: {
                  columns: {
                    model: true
                  },
                  with: {
                    brand: {
                      columns: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    return pendingOrders;
    
  } catch (error) {
    console.error("(server) failed to retrieve pending orders count", error);
    throw error;  
  }
}

export async function getAllDeliveredOrders() {
  try {
    const deliveredOrders = await db.query.orders.findMany({
      where: eq(orders.status, "DELIVERED")
    });

    return deliveredOrders;
  } catch (error) {
    console.error("(server) failed to retrieve delivered orders", error);
    throw error;  
  }
}






export async function createOrder(
  orderDetails: OrderDetails, // a bit confusing 
  newBillingAddress: Omit<NewOrderAddressModel, "id">,
  newShippingAddress?: Omit<NewOrderAddressModel, "id">
) {
  try {
    const result = await db.transaction(async (tx) => {

      // If customer already has a pending order return early (it will only be pending for 30min)
      const foundOrderId = await doesCustomerHasExistingOrder(orderDetails, newBillingAddress, newShippingAddress, tx)
      if(foundOrderId) return foundOrderId;

      const foundProduct = await getProductById(orderDetails.productId, tx);
      if(!foundProduct) throw new Error(`(server) no product found with id: ${orderDetails.productId}`)


      const stockAvailable = await checkAndUpdateProductStock(foundProduct.id, tx);
      if(!stockAvailable) throw new Error(`(server) Product just sold out`)


      let shippingAddressId;
      if (newShippingAddress) {
        const createdShippingAddress = await createOrderAddress(
          newShippingAddress,
          tx
        );
        shippingAddressId = createdShippingAddress.id;
      }
      const createdBillingAddress = await createOrderAddress(
        newBillingAddress,
        tx
      );
      const billingAddressId = createdBillingAddress.id;

      // deæoveryAddress is the same as shipping address
      orderDetails.deliveryAddressId = shippingAddressId;
      orderDetails.billingAddressId = billingAddressId;
      const createdOrder = await tx
        .insert(orders)
        .values(orderDetails)
        .returning();
      const orderId = createdOrder[0].id;

      const orderItem = {
        orderId,
        productId: foundProduct.id,
        quantity: 1,
      };

      await createOrderItem(orderItem, tx);

      return orderId;
    });

    return result;
  } catch (error) {
    console.error("(server) failed creating new order...", error);
    throw error;
  }
}

export async function getOrderById(orderId: string) {
  try {
    const foundOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        user: true,
        currency: true,
        billingAddress: true,
        deliveryAddress: true,
        orderItems: {
          with: {
            product: {
              with: {
                productImages: true,
                watch: {
                  with: {
                    brand: true,
                  }
                }
              },
            }
          }
        }
      }
    });

    return foundOrder;
  } catch (error) {
    console.error(`(server) failed to retrieve order for order id: ${orderId}`, error);
    throw error;
  }
}






export async function changeOrderStatus(orderId: string, newStatus: OrderStatus) {
  try {
    const result = await db.transaction(async (tx) => {
      
      const previousOrderState = await tx.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
          orderItems: {
            columns: { 
              quantity: true
            },
            with: {
              product: {
                columns: {
                  id: true
                }
              }
            }
          }
        }
      }); 

      if (!previousOrderState) {
        throw new Error(`(server) no order found with id: ${orderId}`);
      }

      const updatedOrder = await tx
        .update(orders)
        .set({ status: newStatus })
        .where(eq(orders.id, orderId))
        .returning();

      
      const activeStatuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];
      const inactiveStatuses = ["CANCELLED", "RETURNED", "REFUNDED"]; // for docs purposes

      const previousStatus = previousOrderState.status;
      const wasActive = activeStatuses.includes(previousStatus);
      const isNowActive = activeStatuses.includes(newStatus);

      let shouldUpdateStock = false;
      let isIncrementStock = false;

      if (wasActive && !isNowActive) {
        // Moving from Active → Inactive: increment stock (return item to inventory)
        shouldUpdateStock = true;
        isIncrementStock = true;

      } else if (!wasActive && isNowActive) {
        // Moving from Inactive → Active: decrement stock (take item from inventory)
        shouldUpdateStock = true;
        isIncrementStock = false;
      }
      // If both are active or both are inactive: no stock change needed

      if (shouldUpdateStock) {
        await updateProductStock(
          previousOrderState.orderItems[0].product.id, 
          previousOrderState.orderItems[0].quantity,
          tx,
          isIncrementStock
        );
      }

      return updatedOrder[0];
    });

    return result;

  } catch (error) {
    console.error(`(server) failed to change order status`, error);
    throw error;
  }
}






//--------------------------------------- helper functions ---------------------------------------
async function getCustomerOrder(customerId: string, productId: string, tx?: DbTransaction) {
  const dbContext = tx || db;

  const [foundOrder] = await dbContext
    .select()
    .from(orders)
    // Join orderItems to filter the parent (orders) row
    .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.userId, customerId),
        eq(orders.status, "RESERVED"),
        eq(orderItems.productId, productId) // Now this correctly filters the entire row
      )
    )
    .limit(1);


  if (!foundOrder) {
    return null;
  }

  const orderWithRelations = await dbContext.query.orders.findFirst({
    where: eq(orders.id, foundOrder.orders.id),
    with: {
      billingAddress: true,
      deliveryAddress: true,
    },
  });

  return orderWithRelations;
}



async function doesCustomerHasExistingOrder(
  orderDetails: OrderDetails, 
  newBillingAddress: Omit<NewOrderAddressModel, "id">,
  newShippingAddress: Omit<NewOrderAddressModel, "id"> | undefined,
  tx: DbTransaction
) {

  const customerOrder = await getCustomerOrder(orderDetails.userId, orderDetails.productId, tx);      
  if ( customerOrder ) {

    if (newShippingAddress) {
      await updateOrderAddress(
        customerOrder.deliveryAddress?.id as string,
        newShippingAddress,
        tx
      );
    }

    await updateOrderAddress(
      customerOrder.billingAddress?.id as string,
      newBillingAddress,
      tx
    );

    return customerOrder.id;
  }

  return null;
}
