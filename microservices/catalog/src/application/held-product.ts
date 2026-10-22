import type { Availability, Product } from "../domain/product.js";
import type { Reservation } from "../domain/reservation.js";

export function productIsHeld(reservations: readonly Reservation[], productId: string, exceptOrderId: string): boolean {
  return reservations.some(
    (reservation) =>
      reservation.orderId !== exceptOrderId &&
      reservation.status === "active" &&
      reservation.items.some((line) => line.productId === productId && line.quantity > 0),
  );
}

// Reserved while another order still holds a unit. Available when sellable stock remains. Sold when it does not.
export function availabilityAfterChange(stillHeld: boolean, stock: number): Availability {
  if (stillHeld) return "reserved";
  if (stock > 0) return "available";
  return "sold";
}

export function copyHeldProduct(product: Product, stock: number, stillHeld: boolean): Product {
  return {
    ...product,
    price: { ...product.price },
    stock,
    version: product.version + 1,
    availability: availabilityAfterChange(stillHeld, stock),
  };
}
