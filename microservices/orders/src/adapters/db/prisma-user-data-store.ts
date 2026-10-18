import type { AnonymiseInput, AnonymiseResult, UserDataStore } from "../../application/ports/user-data-store.js";
import { orderWithRelations, toOrder } from "./prisma-order-repository.js";
import type { Database } from "./prisma.js";

export class PrismaUserDataStore implements UserDataStore {
  constructor(private readonly database: Database) {}

  anonymiseUser({ eventId, userId, replacement, cancelEvent }: AnonymiseInput): Promise<AnonymiseResult> {
    return this.database.$transaction(async (tx): Promise<AnonymiseResult> => {
      const inbox = await tx.processedEvent.createMany({ data: [{ eventId, type: "user_deleted" }], skipDuplicates: true });
      if (inbox.count === 0) return { kind: "duplicate" };

      // Waits for a sweeper or status change holding one of these rows; Postgres then re-checks the status,
      // so an order that just expired or got paid is not cancelled. A payment handler arriving after the
      // cancel sees CANCELLED and requests a refund.
      const reserved = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM orders WHERE user_id = ${userId}::uuid AND status = 'RESERVED' FOR UPDATE`;
      if (reserved.length) {
        const ids = reserved.map((row) => row.id);
        const rows = await tx.order.findMany({ where: { id: { in: ids } }, include: orderWithRelations });
        await tx.order.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED" } });
        await tx.outboxEvent.createMany({
          data: rows.map((row) => {
            const event = cancelEvent(toOrder(row));
            return { id: event.id, type: event.type, payload: event };
          }),
        });
      }

      const orders = await tx.order.findMany({
        where: { userId },
        select: { id: true, billingAddressId: true, deliveryAddressId: true },
      });
      if (!orders.length) return { kind: "applied", orders: 0, cancelled: 0 };

      const orderIds = orders.map((order) => order.id);
      const addressIds = orders.flatMap((order) => [order.billingAddressId, order.deliveryAddressId]).filter((id) => id !== null);

      await tx.order.updateMany({ where: { userId }, data: { customerEmail: replacement.customerEmail } });
      await tx.orderAddress.updateMany({
        where: { id: { in: addressIds } },
        data: {
          firstName: replacement.firstName,
          middleName: replacement.middleName,
          lastName: replacement.lastName,
          addressLine1: replacement.addressLine1,
          addressLine2: replacement.addressLine2,
        },
      });
      // Published events are history with no further use; unpublished ones (like the order_cancelled events
      // above, which hold no personal data) still have to reach their consumers.
      await tx.$executeRaw`
        DELETE FROM outbox
        WHERE published_at IS NOT NULL AND payload->>'subject' = ANY(${orderIds}::text[])`;
      return { kind: "applied", orders: orders.length, cancelled: reserved.length };
    });
  }
}
