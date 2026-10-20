import type { ReservationSnapshot, ReservationStore, ReserveDecision, ReserveResult } from "../../application/ports/reservation-store.js";
import type { AvailabilityEvent } from "../../domain/availability-event.js";
import type { Product } from "../../domain/product.js";
import type { Reservation } from "../../domain/reservation.js";

function copyProduct(product: Product): Product {
  return { ...product, price: { ...product.price } };
}

export function createInMemoryReservationStore(initialProducts: readonly Product[]): ReservationStore {
  let products = initialProducts.map(copyProduct);
  const reservations = new Map<string, Reservation>();
  let events: AvailabilityEvent[] = [];

  return {
    reserve(orderId, decide) {
      const snapshot: ReservationSnapshot = {
        reservation: reservations.get(orderId) ?? null,
        products: products.map(copyProduct),
      };
      const decision: ReserveDecision = decide(snapshot);
      if (decision.kind === "replay") return Promise.resolve({ outcome: "replayed", reservation: decision.reservation });
      if (decision.kind === "reject") return Promise.resolve({ outcome: "out_of_stock", unavailableProductIds: decision.unavailableProductIds });
      products = decision.products.map(copyProduct);
      reservations.set(decision.reservation.orderId, decision.reservation);
      events = [...events, ...decision.events];
      const reserved: ReserveResult = { outcome: "reserved", reservation: decision.reservation };
      return Promise.resolve(reserved);
    },
    product(productId) {
      return Promise.resolve(products.find((product) => product.productId === productId) ?? null);
    },
    events() {
      return Promise.resolve([...events]);
    },
  };
}
