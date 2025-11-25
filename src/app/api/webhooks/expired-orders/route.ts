import { db } from "@/database/drizzle";
import { orders, products } from "@/database/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {

    //TODO implemented HMAC signatures (Hash-based Message Authentication Codes) basicly stronger auth
    const secret = req.headers.get("x-limitedwatches-secret");
    if (secret !== process.env.LIMITED_WATCHES_WEBHOOK_SECRET!) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const releasedOrders = await db.transaction(async (tx) => {
      
      const THIRTY_MINUTES = 30 * 60 * 1000; // ms
      const cutoff = new Date(Date.now() - THIRTY_MINUTES);

      const updatedOrders = await tx
        .update(orders)
        .set({ status: "EXPIRED" })
        .where(and(
          lt(orders.createdAt, cutoff),
          eq(orders.status, "RESERVED")
        ))
        .returning();

      const foundOrders = await tx.query.orders.findMany({
        where: inArray(orders.id, updatedOrders.map(order => order.id)),
          with: {
            orderItems: true
          }
      })

      for (const order of foundOrders) {
        for (const orderItem of order.orderItems) {
            
          await tx
            .update(products)
            .set({ 
              stock: sql`${products.stock} + ${orderItem.quantity}` 
            })
            .where(eq(products.id, orderItem.productId)); 
        }
      }

      return updatedOrders;
    })



    if(releasedOrders.length > 0) {
      return NextResponse.json({ result: {
        message: `Released ${releasedOrders.length} reserved orders`,
        data: releasedOrders
      }}, { status: 200 });
    }

    return NextResponse.json({ message: "No expired orders" }, { status: 200 });

  } catch (error: any) {
    console.error("(server) failed to release reserved orders", error);
    return NextResponse.json({ message: `(server) Unexpted error when relasing reserved orders: ${error.message}` }, { status: 500 })
  }
}
