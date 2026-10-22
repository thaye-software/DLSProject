import type {
  CancelDecision,
  CancelResult,
  ConfirmDecision,
  ConfirmEvent,
  ConfirmResult,
  ExpireResult,
  ReleaseDecision,
  ReleaseResult,
  ReservationSnapshot,
  ReservationStore,
  ReserveDecision,
  ReserveResult,
} from "../../application/ports/reservation-store.js";
import { cancelUnchanged, unchangedKnown } from "../../application/unchanged-outcome.js";
import type { AvailabilityEvent } from "../../domain/availability-event.js";
import type { Product } from "../../domain/product.js";
import type { Reservation } from "../../domain/reservation.js";

type MemoryState = {
  products: Product[];
  reservations: Map<string, Reservation>;
  events: AvailabilityEvent[];
  processed: Set<string>;
};

type ApplyBody = {
  kind: "apply";
  reservation: Reservation;
  products: readonly Product[];
  events: readonly AvailabilityEvent[];
};

function copyProduct(product: Product): Product {
  return { ...product, price: { ...product.price } };
}

function copyReservation(reservation: Reservation): Reservation {
  return {
    ...reservation,
    expiresAt: new Date(reservation.expiresAt),
    createdAt: new Date(reservation.createdAt),
    items: reservation.items.map((line) => ({ ...line, unitPrice: { ...line.unitPrice } })),
  };
}

function snapshotFor(state: MemoryState, orderId: string): ReservationSnapshot {
  const reservation = state.reservations.get(orderId);
  return {
    reservation: reservation ? copyReservation(reservation) : null,
    reservations: [...state.reservations.values()].map(copyReservation),
    products: state.products.map(copyProduct),
  };
}

function remember(state: MemoryState, decision: ApplyBody): void {
  state.products = decision.products.map(copyProduct);
  state.reservations.set(decision.reservation.orderId, copyReservation(decision.reservation));
  state.events = [...state.events, ...decision.events];
}

function reserveInMemory(state: MemoryState, orderId: string, decide: (snapshot: ReservationSnapshot) => ReserveDecision): Promise<ReserveResult> {
  const decision = decide(snapshotFor(state, orderId));
  if (decision.kind === "replay") return Promise.resolve({ outcome: "replayed", reservation: decision.reservation });
  if (decision.kind === "reject") return Promise.resolve({ outcome: "out_of_stock", unavailableProductIds: decision.unavailableProductIds });
  remember(state, decision);
  return Promise.resolve({ outcome: "reserved", reservation: decision.reservation });
}

function releaseInMemory(state: MemoryState, orderId: string, decide: (snapshot: ReservationSnapshot) => ReleaseDecision): Promise<ReleaseResult> {
  const decision = decide(snapshotFor(state, orderId));
  return decision.kind === "unchanged" ? Promise.resolve(unchangedKnown(decision)) : rememberRelease(state, decision);
}

function rememberRelease(state: MemoryState, decision: ApplyBody): Promise<ReleaseResult> {
  remember(state, decision);
  return Promise.resolve({ outcome: "released", reservation: decision.reservation });
}

function applyRecorded<Decision extends { kind: "unchanged" } | ApplyBody, Result>(
  state: MemoryState,
  orderId: string,
  eventId: string,
  decide: (snapshot: ReservationSnapshot) => Decision,
  unchanged: (decision: Extract<Decision, { kind: "unchanged" }>) => Result,
  applied: (reservation: Reservation) => Result,
  duplicate: Result,
): Promise<Result> {
  if (state.processed.has(eventId)) return Promise.resolve(duplicate);
  const decision = decide(snapshotFor(state, orderId));
  // A generic union of the two kinds does not narrow on `kind`, so the sides are named here.
  if (decision.kind === "unchanged") return Promise.resolve(unchanged(decision as Extract<Decision, { kind: "unchanged" }>));
  const appliedDecision = decision as ApplyBody;
  remember(state, appliedDecision);
  state.processed.add(eventId);
  return Promise.resolve(applied(appliedDecision.reservation));
}

function confirmInMemory(state: MemoryState, orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => ConfirmDecision): Promise<ConfirmResult> {
  return applyRecorded<ConfirmDecision, ConfirmResult>(state, orderId, event.id, decide, unchangedKnown, (reservation) => ({ outcome: "confirmed", reservation }), { outcome: "duplicate" });
}

function cancelInMemory(state: MemoryState, orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => CancelDecision): Promise<CancelResult> {
  return applyRecorded<CancelDecision, CancelResult>(state, orderId, event.id, decide, cancelUnchanged, (reservation) => ({ outcome: "released", reservation }), { outcome: "duplicate" });
}

function expireInMemory(state: MemoryState, orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => ReleaseDecision): Promise<ExpireResult> {
  return applyRecorded<ReleaseDecision, ExpireResult>(state, orderId, event.id, decide, unchangedKnown, (reservation) => ({ outcome: "released", reservation }), { outcome: "duplicate" });
}

export function createInMemoryReservationStore(
  initialProducts: readonly Product[],
  initialReservations: readonly Reservation[] = [],
): ReservationStore {
  const state: MemoryState = {
    products: initialProducts.map(copyProduct),
    reservations: new Map(initialReservations.map((reservation) => [reservation.orderId, copyReservation(reservation)])),
    events: [],
    processed: new Set(),
  };

  return {
    reserve: (orderId, decide) => reserveInMemory(state, orderId, decide),
    release: (orderId, decide) => releaseInMemory(state, orderId, decide),
    confirm: (orderId, event, decide) => confirmInMemory(state, orderId, event, decide),
    cancel: (orderId, event, decide) => cancelInMemory(state, orderId, event, decide),
    expire: (orderId, event, decide) => expireInMemory(state, orderId, event, decide),
    reservations: () => Promise.resolve([...state.reservations.values()].map(copyReservation)),
    product: (productId) => Promise.resolve(state.products.find((product) => product.productId === productId) ?? null),
    events: () => Promise.resolve([...state.events]),
  };
}
