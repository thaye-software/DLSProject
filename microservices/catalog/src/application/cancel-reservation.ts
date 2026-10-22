import type { Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";
import type { CancelDecision, CancelResult } from "./ports/reservation-store.js";
import { findOpenReservation, returnReservedQuantities } from "./release-reservation.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";

// A customer cancel is still active. An admin cancel of a paid order is already confirmed. Both put the stored quantities back once.
export async function cancelReservation(
  orderId: string,
  eventId: string,
  { store, now, newId }: ReserveStockDependencies,
): Promise<CancelResult> {
  const at = now();
  return store.cancel(orderId, { id: eventId, type: "order_cancelled" }, (snapshot) =>
    planCancel(snapshot.reservations, snapshot.products, orderId, eventId, at, newId),
  );
}

export function planCancel(
  reservations: readonly Reservation[],
  products: readonly Product[],
  orderId: string,
  eventId: string,
  now: Date,
  newId: () => string,
): CancelDecision {
  const found = findOpenReservation(reservations, orderId);
  if (found.kind === "unchanged") return found;
  return returnReservedQuantities(found.reservation, reservations, products, now, newId, eventId);
}
