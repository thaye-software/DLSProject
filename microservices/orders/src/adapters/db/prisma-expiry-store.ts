import type { ExpireDueInput, ExpiryStore } from "../../application/ports/expiry-store.js";
import { orderWithRelations, toOrder } from "./prisma-order-repository.js";
import type { Database } from "./prisma.js";

export class PrismaExpiryStore implements ExpiryStore {
  constructor(private readonly database: Database) {}

  expireDue({ now, limit, buildEvent }: ExpireDueInput): Promise<string[]> {
    return this.database.$transaction(async (tx) => {
      // expires_at is a UTC timestamp without time zone (how Prisma stores DateTime), so compare in UTC
      // whatever the session's TimeZone is.
      // The row locks make a concurrent payment_complete wait, then see EXPIRED and request a refund.
      // SKIP LOCKED lets several Orders instances sweep without picking the same order.
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM orders
        WHERE status = 'RESERVED' AND expires_at <= (${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        ORDER BY expires_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      if (!due.length) return [];

      const ids = due.map((row) => row.id);
      const rows = await tx.order.findMany({ where: { id: { in: ids } }, include: orderWithRelations });
      await tx.order.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } });
      await tx.outboxEvent.createMany({
        data: rows.map((row) => {
          const event = buildEvent(toOrder(row));
          return { id: event.id, type: event.type, payload: event };
        }),
      });
      return ids;
    });
  }
}
