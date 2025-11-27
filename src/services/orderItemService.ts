import { eq } from "drizzle-orm";
import { db } from "@/database/drizzle";
import { orderItems } from "@/database/schema";
import { NewOrderItemModel, OrderItemModel } from "@/database/types";

//todo we should create reference number instead on use that instead of the auto incremented id... laster tho
export async function getOrderItemByOrderId(orderId: string) {
  try {
    const foundOrderItem = await db.query.orderItems.findFirst({
      where: eq(orderItems.orderId, orderId),
      columns: {
        id: true,
        quantity: true,
      },
      with: {
        order: {
          columns: {
            subTotalDkk: true,
            totalPriceDkk: true,
            shippingPriceDkk: true,
            createdAt: true,
            status: true,
          },
          with: {
            user: {
              columns: {
                email: true,
              },
            },
            billingAddress: {
              columns: {
                firstName: true,
                middleName: true,
                lastName: true,
                country: true,
              },
            },
            deliveryAddress: {
              columns: {
                country: true,
              },
            },
            currency: {
              columns: {
                code: true,
              },
            },
          },
        },
        product: {
          with: {
            productImages: true,
            watch: {
              columns: {
                model: true,
              },
              with: {
                brand: {
                  columns: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return foundOrderItem;
  } catch (error) {
    console.error(
      `(server) failed to retrieve order item for order id: ${orderId}`,
      error
    );
    throw error;
  }
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function createOrderItem(
  newOrderItem: Omit<NewOrderItemModel, "id">,
  tx?: DbTransaction
): Promise<OrderItemModel> {
  try {
    const dbContext = tx || db;
    const createdOrderItem = await dbContext
      .insert(orderItems)
      .values(newOrderItem)
      .returning();
    return createdOrderItem[0];
  } catch (error) {
    console.error("(server) failed to create new order item...", error);
    throw error;
  }
}
