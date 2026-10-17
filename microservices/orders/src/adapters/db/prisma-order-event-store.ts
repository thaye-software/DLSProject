import type { ApplyInput, ApplyResult, OrderEventStore } from "../../application/ports/order-event-store.js";
import { orderWithRelations, toOrder } from "./prisma-order-repository.js";
import type { Database } from "./prisma.js";

export class PrismaOrderEventStore implements OrderEventStore {
  constructor(private readonly database: Database) {}

  apply({ eventId, eventType, orderId, decide }: ApplyInput): Promise<ApplyResult> {
    return this.database.$transaction(async (tx) => {
      // ON CONFLICT DO NOTHING: a concurrent delivery of the same event waits on this row, then sees count 0.
      const inbox = await tx.processedEvent.createMany({ data: [{ eventId, type: eventType }], skipDuplicates: true });
      if (inbox.count === 0) return { kind: "duplicate" } as const;

      const row = await tx.order.findUnique({ where: { id: orderId }, include: orderWithRelations });
      if (!row) throw new Error(`Order ${orderId} not found`);
      const order = toOrder(row);
      const decision = decide(order);

      if (decision.status && decision.status !== order.status) {
        // Only from the status the decision was based on; if it moved meanwhile, roll back and let the consumer retry.
        const updated = await tx.order.updateMany({
          where: { id: orderId, status: order.status },
          data: { status: decision.status },
        });
        if (updated.count !== 1) throw new Error(`Order ${orderId} changed while handling ${eventType} ${eventId}`);
      }

      if (decision.publish.length) {
        await tx.outboxEvent.createMany({
          data: decision.publish.map((event) => ({ id: event.id, type: event.type, payload: event })),
        });
      }
      return { kind: "applied", note: decision.note } as const;
    });
  }
}
