"use server";

import { redirect } from "next/navigation";

import { withLoginRedirect } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";
import { createOrder, type Address } from "@/services/orderService";

export type CheckoutState = { error?: string };

function readAddress(form: FormData, prefix: string): Address {
  const text = (k: string) => String(form.get(`${prefix}_${k}`) ?? "").trim();
  const optional = (k: string) => text(k) || null;
  return {
    first_name: text("first_name"),
    middle_name: optional("middle_name"),
    last_name: text("last_name"),
    address_line_1: text("address_line_1"),
    address_line_2: optional("address_line_2"),
    city: text("city"),
    zip_code: text("zip_code"),
    state_province: optional("state_province"),
    country_code: text("country_code"),
  };
}

export async function submitCheckout(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const billing = readAddress(form, "billing");
  const delivery = form.get("same_as_billing") ? billing : readAddress(form, "delivery");

  let orderId: string;
  try {
    const order = await withLoginRedirect(() =>
      createOrder({
        items: [{ product_id: String(form.get("product_id") ?? ""), quantity: 1 }],
        billing_address: billing,
        delivery_address: delivery,
      }),
    );
    orderId = order.order_id;
  } catch (e) {
    // 409 (product unavailable) and 422 (validation) problems show their title/detail
    return { error: problemMessage(e, "The order could not be created. Please try again later.", "Create order failed") };
  }
  redirect(`/orders/checkout/payment?order=${encodeURIComponent(orderId)}`);
}
