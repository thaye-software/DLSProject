import type {
  CancelDecision,
  CancelResult,
  ConfirmDecision,
  ExpireResult,
  ConfirmResult,
  ReleaseDecision,
  ReleaseResult,
  ReservationSnapshot,
  ReservationStore,
  ReserveDecision,
  ReserveResult,
} from "../../application/ports/reservation-store.js";
import type { AvailabilityEvent } from "../../domain/availability-event.js";
import type { Product } from "../../domain/product.js";
import type { Reservation } from "../../domain/reservation.js";

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

export function createInMemoryReservationStore(
  initialProducts: readonly Product[],
  initialReservations: readonly Reservation[] = [],
): ReservationStore {
  let products = initialProducts.map(copyProduct);
  const reservations = new Map(initialReservations.map((reservation) => [reservation.orderId, copyReservation(reservation)]));
  let events: AvailabilityEvent[] = [];
  const processed = new Set<string>();

  const snapshotFor = (orderId: string): ReservationSnapshot => {
    const reservation = reservations.get(orderId);
    return {
      reservation: reservation ? copyReservation(reservation) : null,
      reservations: [...reservations.values()].map(copyReservation),
      products: products.map(copyProduct),
    };
  };

  return {
    reserve(orderId, decide) {
      const decision: ReserveDecision = decide(snapshotFor(orderId));
      if (decision.kind === "replay") return Promise.resolve({ outcome: "replayed", reservation: decision.reservation });
      if (decision.kind === "reject") return Promise.resolve({ outcome: "out_of_stock", unavailableProductIds: decision.unavailableProductIds });
      products = decision.products.map(copyProduct);
      reservations.set(decision.reservation.orderId, copyReservation(decision.reservation));
      events = [...events, ...decision.events];
      const reserved: ReserveResult = { outcome: "reserved", reservation: decision.reservation };
      return Promise.resolve(reserved);
    },
    release(orderId, decide) {
      const decision: ReleaseDecision = decide(snapshotFor(orderId));
      if (decision.kind === "unchanged") {
        return Promise.resolve(decision.outcome === "unknown" ? { outcome: "unknown" } : { outcome: decision.outcome, reservation: decision.reservation });
      }
      products = decision.products.map(copyProduct);
      reservations.set(decision.reservation.orderId, copyReservation(decision.reservation));
      events = [...events, ...decision.events];
      const released: ReleaseResult = { outcome: "released", reservation: decision.reservation };
      return Promise.resolve(released);
    },
    confirm(orderId, event, decide) {
      if (processed.has(event.id)) return Promise.resolve({ outcome: "duplicate" });
      const decision: ConfirmDecision = decide(snapshotFor(orderId));
      if (decision.kind === "unchanged") {
        const unchanged: ConfirmResult =
          decision.outcome === "unknown" ? { outcome: "unknown" } : { outcome: decision.outcome, reservation: decision.reservation };
        return Promise.resolve(unchanged);
      }
      products = decision.products.map(copyProduct);
      reservations.set(decision.reservation.orderId, copyReservation(decision.reservation));
      events = [...events, ...decision.events];
      processed.add(event.id);
      const confirmed: ConfirmResult = { outcome: "confirmed", reservation: decision.reservation };
      return Promise.resolve(confirmed);
    },
    cancel(orderId, event, decide) {
      if (processed.has(event.id)) return Promise.resolve({ outcome: "duplicate" });
      const decision: CancelDecision = decide(snapshotFor(orderId));
      if (decision.kind === "unchanged") {
        const unchanged: CancelResult =
          decision.outcome === "already_released"
            ? { outcome: "already_released", reservation: decision.reservation }
            : { outcome: decision.outcome };
        return Promise.resolve(unchanged);
      }
      products = decision.products.map(copyProduct);
      reservations.set(decision.reservation.orderId, copyReservation(decision.reservation));
      events = [...events, ...decision.events];
      processed.add(event.id);
      const released: CancelResult = { outcome: "released", reservation: decision.reservation };
      return Promise.resolve(released);
    },
    expire(orderId, event, decide) {
      if (processed.has(event.id)) return Promise.resolve({ outcome: "duplicate" });
      const decision: ReleaseDecision = decide(snapshotFor(orderId));
      if (decision.kind === "unchanged") {
        const unchanged: ExpireResult =
          decision.outcome === "unknown" ? { outcome: "unknown" } : { outcome: decision.outcome, reservation: decision.reservation };
        return Promise.resolve(unchanged);
      }
      products = decision.products.map(copyProduct);
      reservations.set(decision.reservation.orderId, copyReservation(decision.reservation));
      events = [...events, ...decision.events];
      processed.add(event.id);
      const released: ExpireResult = { outcome: "released", reservation: decision.reservation };
      return Promise.resolve(released);
    },
    reservations() {
      return Promise.resolve([...reservations.values()].map(copyReservation));
    },
    product(productId) {
      return Promise.resolve(products.find((product) => product.productId === productId) ?? null);
    },
    events() {
      return Promise.resolve([...events]);
    },
  };
}
