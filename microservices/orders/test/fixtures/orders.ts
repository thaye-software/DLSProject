import type { CreateOrderRequest } from "../../src/application/create-order.js";
import type { Address, Order, OrderLine } from "../../src/domain/order.js";

export const USER_ID = "2b6f0c1e-4d53-4a8e-9a39-1f0f6b3c7a11";
export const IDEMPOTENCY_KEY = "1f0e2d3c-4b5a-4968-8776-655443322110";
export const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
export const OTHER_PRODUCT_ID = "0c5e1f2a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";

export const address: Address = {
  firstName: "Mette",
  middleName: null,
  lastName: "Jensen",
  addressLine1: "Nørregade 12",
  addressLine2: null,
  city: "København K",
  zipCode: "1165",
  stateProvince: null,
  countryCode: "DK",
};

export const addressJson = {
  first_name: "Mette",
  middle_name: null,
  last_name: "Jensen",
  address_line_1: "Nørregade 12",
  address_line_2: null,
  city: "København K",
  zip_code: "1165",
  state_province: null,
  country_code: "DK",
};

export const submarinerLine: OrderLine = {
  productId: PRODUCT_ID,
  productName: "Rolex Submariner Date 126610LN",
  quantity: 1,
  thumbnailUrl: "https://cdn.example.com/products/126610ln-1.jpg",
  unitPriceDkk: 11_500_000,
};

export const createOrderRequest: CreateOrderRequest = {
  userId: USER_ID,
  customerEmail: "mette@example.com",
  idempotencyKey: IDEMPOTENCY_KEY,
  items: [{ productId: PRODUCT_ID, quantity: 1 }],
  billingAddress: address,
  deliveryAddress: address,
};

export function reservedOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    userId: USER_ID,
    customerEmail: "mette@example.com",
    status: "RESERVED",
    items: [submarinerLine],
    subTotalDkk: 11_500_000,
    shippingPriceDkk: 30_000,
    totalPriceDkk: 11_530_000,
    billingAddress: address,
    deliveryAddress: address,
    createdAt: new Date("2026-10-14T10:00:00Z"),
    expiresAt: new Date("2026-10-14T10:30:00Z"),
    ...overrides,
  };
}
