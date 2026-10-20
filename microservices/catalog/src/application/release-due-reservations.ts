import { releaseReservation } from "./release-reservation.js";
import type { ReserveStockDependencies } from "./reserve-stock.js";

// Orders expires a reserved order at expires_at. Catalog waits five more minutes, for Orders being down.
export const SAFETY_NET_GRACE_MS = 5 * 60 * 1000;

// Releases every reservation still active at expires_at plus five minutes. Returns how many this pass released.
export async function releaseDueReservations(dependencies: ReserveStockDependencies): Promise<number> {
  const at = dependencies.now();
  const due = (await dependencies.store.reservations()).filter(
    (reservation) => reservation.status === "active" && at.getTime() >= reservation.expiresAt.getTime() + SAFETY_NET_GRACE_MS,
  );
  let released = 0;
  for (const reservation of due) {
    const result = await releaseReservation(reservation.orderId, { ...dependencies, now: () => at });
    if (result.outcome === "released") released += 1;
  }
  return released;
}
