import type { ApplyOrderEventResult, OrderEventInbox, OrderEventInput } from "../../application/ports/order-event-inbox.js";
import type { Database } from "./prisma.js";
import { toReservation } from "./prisma-reservation-store.js";

const reservationWithItems = {
  items: { orderBy: { position: "asc" as const } },
};

// The inbox row and the stock change commit together. A thrown handler leaves neither behind.
export class PrismaOrderEventInbox implements OrderEventInbox {
  constructor(private readonly database: Database) {}

  apply(event: OrderEventInput, changeStock: Parameters<OrderEventInbox["apply"]>[1]): Promise<ApplyOrderEventResult> {
    return this.database.$transaction(async (tx) => {
      const row = await tx.reservation.findUnique({ where: { orderId: event.orderId }, include: reservationWithItems });
      if (!row) return "unknown";

      const inbox = await tx.processedEvent.createMany({ data: [{ eventId: event.id, type: event.type }], skipDuplicates: true });
      if (inbox.count === 0) return "duplicate";

      await changeStock(toReservation(row), {
        setStock: async (productId, stock) => {
          await tx.product.update({ where: { id: productId }, data: { stock } });
        },
      });
      return "applied";
    });
  }
}
