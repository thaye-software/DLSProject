export const ORDER_STATUSES = [
  "RESERVED",
  "EXPIRED",
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// How long a RESERVED order waits for payment before it expires.
export const RESERVATION_TTL_MS = 30 * 60 * 1000;

export type Address = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  zipCode: string;
  stateProvince: string | null;
  countryCode: string;
};

export type ItemQuantity = {
  productId: string;
  quantity: number;
};

// All amounts are DKK in øre.
export type OrderLine = ItemQuantity & {
  productName: string;
  thumbnailUrl: string | null;
  unitPriceDkk: number;
};

export type Order = {
  id: string;
  userId: string;
  customerEmail: string;
  status: OrderStatus;
  items: OrderLine[];
  subTotalDkk: number;
  shippingPriceDkk: number;
  totalPriceDkk: number;
  billingAddress: Address;
  deliveryAddress: Address;
  createdAt: Date;
  expiresAt: Date | null;
};
