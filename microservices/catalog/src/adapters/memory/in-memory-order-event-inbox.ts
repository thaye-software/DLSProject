import type { ReservationStore } from "../../application/ports/reservation-store.js";
import type { ApplyOrderEventResult, OrderEventInbox, OrderEventInput, StockWriter } from "../../application/ports/order-event-inbox.js";

export function createInMemoryOrderEventInbox(store: ReservationStore): OrderEventInbox {
  const processed = new Set<string>();

  return {
    async apply(event: OrderEventInput, changeStock): Promise<ApplyOrderEventResult> {
      const reservation = (await store.reservations()).find((candidate) => candidate.orderId === event.orderId);
      if (!reservation) return "unknown";
      if (processed.has(event.id)) return "duplicate";

      const stock: StockWriter = {
        setStock: () => Promise.reject(new Error("the in-memory inbox does not store stock")),
      };
      await changeStock(reservation, stock);
      processed.add(event.id);
      return "applied";
    },
  };
}
