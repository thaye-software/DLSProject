import { z } from "zod";
import type { OrderEventInbox } from "../../application/ports/order-event-inbox.js";
import { handleEvent, type EventHandler } from "./consumer.js";

// Turns one CloudEvent into an inbox apply. Routing keys stay unbound until a commit handles that event.
export function orderEventHandler(
  inbox: OrderEventInbox,
  changeStock: Parameters<OrderEventInbox["apply"]>[1],
): EventHandler {
  return handleEvent(z.object({ order_id: z.uuid() }), async (data, event) => {
    await inbox.apply({ id: event.id, type: event.type, orderId: data.order_id }, changeStock);
  });
}
