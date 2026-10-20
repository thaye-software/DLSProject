import type { Availability } from "./product.js";

export const AVAILABILITY_REASONS = ["order_reserved", "order_released", "order_confirmed", "admin_update"] as const;

export type AvailabilityReason = (typeof AVAILABILITY_REASONS)[number];

export type AvailabilityEvent = {
  specversion: "1.0";
  id: string;
  source: "/services/catalog";
  type: "product_availability_changed";
  time: string;
  datacontenttype: "application/json";
  subject: string;
  dataversion: 1;
  correlationid: string;
  causationid: string | null;
  data: {
    product_id: string;
    version: number;
    availability: Availability;
    previous_availability: Availability;
    stock: number;
    reason: AvailabilityReason;
    order_id: string | null;
    changed_at: string;
  };
};

export function availabilityEvent(input: {
  id: string;
  productId: string;
  orderId: string;
  time: Date;
  version: number;
  availability: Availability;
  previousAvailability: Availability;
  stock: number;
  reason: AvailabilityReason;
  causationId: string | null;
}): AvailabilityEvent {
  const time = input.time.toISOString();
  return {
    specversion: "1.0",
    id: input.id,
    source: "/services/catalog",
    type: "product_availability_changed",
    time,
    datacontenttype: "application/json",
    subject: input.productId,
    dataversion: 1,
    correlationid: input.orderId,
    causationid: input.causationId,
    data: {
      product_id: input.productId,
      version: input.version,
      availability: input.availability,
      previous_availability: input.previousAvailability,
      stock: input.stock,
      reason: input.reason,
      order_id: input.orderId,
      changed_at: time,
    },
  };
}
