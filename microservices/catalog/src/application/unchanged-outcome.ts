import type { Reservation } from "../domain/reservation.js";
import type { CancelDecision, CancelResult } from "./ports/reservation-store.js";

export function unchangedKnown<Outcome extends string>(
  decision: { outcome: "unknown" } | { outcome: Outcome; reservation: Reservation },
): { outcome: "unknown" } | { outcome: Outcome; reservation: Reservation } {
  if ("reservation" in decision) return { outcome: decision.outcome, reservation: decision.reservation };
  return { outcome: "unknown" };
}

export function cancelUnchanged(
  decision: Extract<CancelDecision, { kind: "unchanged" }>,
): Exclude<CancelResult, { outcome: "released" | "duplicate" }> {
  if (decision.outcome === "already_released") return { outcome: "already_released", reservation: decision.reservation };
  return { outcome: decision.outcome };
}
