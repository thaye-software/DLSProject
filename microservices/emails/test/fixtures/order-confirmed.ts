export const orderConfirmedEvent = {
  specversion: "1.0",
  id: "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b",
  source: "/services/orders",
  type: "order_confirmed",
  time: "2026-10-14T10:00:00Z",
  datacontenttype: "application/json",
  subject: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  dataversion: 1,
  correlationid: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  causationid: null,
  data: {
    order_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    user_id: "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11",
    customer_email: "mette@example.com",
    status: "PENDING",
    items: [
      {
        product_id: "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55",
        product_name: "Rolex Submariner Date 126610LN",
        quantity: 1,
        thumbnail_url: "https://cdn.example.com/products/126610ln-1.jpg",
      },
    ],
    totals: {
      subtotal: { amount_minor: 11500000, currency: "DKK" },
      shipping: { amount_minor: 30000, currency: "DKK" },
      total: { amount_minor: 11530000, currency: "DKK" },
      total_charged: { amount_minor: 11530000, currency: "DKK" },
    },
    billing_address: {
      first_name: "Mette",
      middle_name: null,
      last_name: "Jensen",
      address_line_1: "Nørregade 12",
      address_line_2: null,
      city: "København K",
      zip_code: "1165",
      state_province: null,
      country_code: "DK",
    },
    delivery_address: {
      first_name: "Mette",
      middle_name: null,
      last_name: "Jensen",
      address_line_1: "Nørregade 12",
      address_line_2: null,
      city: "København K",
      zip_code: "1165",
      state_province: null,
      country_code: "DK",
    },
    confirmed_at: "2026-10-14T10:04:10Z",
  },
};

export type OrderConfirmedEvent = typeof orderConfirmedEvent;
export type OrderConfirmedData = OrderConfirmedEvent["data"];

export function orderConfirmedData(overrides: Partial<OrderConfirmedData> = {}): OrderConfirmedData {
  return { ...structuredClone(orderConfirmedEvent.data), ...overrides };
}
