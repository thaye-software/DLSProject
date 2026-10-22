import type { ExpireResult } from "./ports/reservation-store.js";
import { planRelease } from "./release-reservation.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";

// Orders' expiry and the five-minute safety net can both see the same hold. Stock comes back only while it is still active.
export async function expireReservation(
  orderId: string,
  eventId: string,
  { store, now, newId }: ReserveStockDependencies,
): Promise<ExpireResult> {
  const at = now();
  return store.expire(orderId, { id: eventId, type: "order_expired" }, (snapshot) =>
    planRelease(snapshot.reservations, snapshot.products, orderId, at, newId, eventId),
  );
}
