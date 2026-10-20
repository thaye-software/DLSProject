export const AVAILABILITIES = ["available", "reserved", "sold", "hidden"] as const;

export type Availability = (typeof AVAILABILITIES)[number];

// amountMinor is DKK in øre. 1 DKK = 100.
export type Money = {
  amountMinor: number;
  currency: "DKK";
};

export type Product = {
  productId: string;
  name: string;
  slug: string;
  brandName: string | null;
  model: string | null;
  price: Money;
  availability: Availability;
  thumbnailUrl: string | null;
};
