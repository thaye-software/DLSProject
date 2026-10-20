import { releaseDueReservations } from "../application/release-due-reservations.js";
import type { ReserveStockDependencies } from "../application/reserve-stock.js";
import { startPolling, type Poller } from "./polling.js";

// Same cadence as Orders' expiry sweeper. The five-minute grace is in releaseDueReservations, not in this interval.
export const SAFETY_NET_INTERVAL_MS = 5000;

export function startReservationSafetyNet(dependencies: ReserveStockDependencies, intervalMs = SAFETY_NET_INTERVAL_MS): Poller {
  return startPolling("Reservation safety net", () => releaseDueReservations(dependencies), intervalMs);
}
