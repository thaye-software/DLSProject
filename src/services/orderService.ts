import { eq, desc, and } from "drizzle-orm";

import { db, DbTransaction } from "@/database/drizzle";
import { orderItems, orders, users } from "@/database/schema";
import { NewOrderModel, NewOrderAddressModel } from "@/database/types";

import { createOrderItem } from "./orderItemService";
import { checkAndUpdateProductStock, getProductById } from "./productService";
import { createOrderAddress, updateOrderAddress } from "./orderAddressService";

import { OrderDetails } from "@/app/orders/actions";






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


      // hardcoded 1 since requirment that customer can only buy one watch at a time.
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
