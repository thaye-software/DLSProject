import type { CommandDecision, CommandResult, OrderCommandStore } from "../../application/ports/order-command-store.js";
import type { Order } from "../../domain/order.js";
import { orderWithRelations, toOrder } from "./prisma-order-repository.js";
import type { Database } from "./prisma.js";

export class PrismaOrderCommandStore implements OrderCommandStore {
  constructor(private readonly database: Database) {}

  change<R extends string>(orderId: string, decide: (order: Order) => CommandDecision<R>): Promise<CommandResult<R>> {
    return this.database.$transaction(async (tx): Promise<CommandResult<R>> => {
      // Held until commit: the sweeper skips this order and payment handlers wait, then see the new status.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      if (!locked.length) return { kind: "not_found" };

      const row = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderWithRelations });
      const order = toOrder(row);
      const decision = decide(order);

      if (decision.kind === "reject") return { kind: "rejected", reason: decision.reason };
      if (decision.kind === "keep") return { kind: "done", order };

      await tx.order.update({ where: { id: orderId }, data: { status: decision.status } });
      if (decision.publish.length) {
        await tx.outboxEvent.createMany({
          data: decision.publish.map((event) => ({ id: event.id, type: event.type, payload: event })),
        });
      }
      return { kind: "done", order: { ...order, status: decision.status } };
    });
  }
}
