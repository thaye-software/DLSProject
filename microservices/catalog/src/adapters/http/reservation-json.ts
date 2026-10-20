import type { Reservation } from "../../domain/reservation.js";

export function reservationJson(reservation: Reservation) {
  return {
    reservation_id: reservation.reservationId,
    order_id: reservation.orderId,
    status: reservation.status,
    items: reservation.items.map((line) => ({
      product_id: line.productId,
      product_name: line.productName,
      quantity: line.quantity,
      unit_price: { amount_minor: line.unitPrice.amountMinor, currency: line.unitPrice.currency },
      thumbnail_url: line.thumbnailUrl,
    })),
    expires_at: reservation.expiresAt.toISOString(),
    created_at: reservation.createdAt.toISOString(),
  };
}
