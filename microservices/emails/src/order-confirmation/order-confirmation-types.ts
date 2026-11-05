import type { Money } from "../shared/money.js";

export type OrderConfirmation = {
  order_id: string;
  customer_email: string;
  items: Array<{
    product_name: string;
    quantity: number;
    thumbnail_url: string | null;
  }>;
  totals: {
    subtotal: Money;
    shipping: Money;
    total: Money;
  };
  billing_address: {
    first_name: string;
    middle_name: string | null;
    last_name: string;
  };
  confirmed_at: string;
};
