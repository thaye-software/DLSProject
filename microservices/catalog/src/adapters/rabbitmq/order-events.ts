import { z } from "zod";
import { cancelReservation } from "../../application/cancel-reservation.js";
import { confirmReservation } from "../../application/confirm-reservation.js";
import { expireReservation } from "../../application/expire-reservation.js";
import type { OrderEventInbox } from "../../application/ports/order-event-inbox.js";
import type { ReserveStockDependencies } from "../../application/reserve-stock.js";
import { handleEvent, type EventHandler } from "./consumer.js";

const orderIdData = z.object({ order_id: z.uuid() });

// Turns one CloudEvent into an inbox apply. Routing keys stay unbound until a commit handles that event.
export function orderEventHandler(
  inbox: OrderEventInbox,
  changeStock: Parameters<OrderEventInbox["apply"]>[1],
): EventHandler {
  return handleEvent(orderIdData, async (data, event) => {
    await inbox.apply({ id: event.id, type: event.type, orderId: data.order_id }, changeStock);
  });
}

// Each key is bound only once this process can apply it.
export function createOrderEventHandlers(dependencies: ReserveStockDependencies): Record<string, EventHandler> {
  return {
    order_confirmed: handleEvent(orderIdData, async (data, event) => {
      await confirmReservation(data.order_id, event.id, dependencies);
    }),
    order_cancelled: handleEvent(orderIdData, async (data, event) => {
      await cancelReservation(data.order_id, event.id, dependencies);
    }),
    order_expired: handleEvent(orderIdData, async (data, event) => {
      await expireReservation(data.order_id, event.id, dependencies);
    }),
  };
}
