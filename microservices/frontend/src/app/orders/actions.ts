"use server";

import { redirect } from "next/navigation";

import { withLoginRedirect } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";
import { createOrder, type Address } from "@/services/orderService";

// values/idempotencyKey come back on error so the form keeps what the user typed and a retry reuses the key.
export type CheckoutState = { error?: string; values?: Record<string, string>; idempotencyKey?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const values: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") values[k] = v;
  });
  const idempotencyKey = values.idempotency_key ?? "";
  const fail = (error: string): CheckoutState => ({ error, values, idempotencyKey });

  // never generate a key here: a server-made key would defeat replay on resubmit
  if (!UUID.test(idempotencyKey)) return fail("The checkout form is out of date. Reload the page and try again.");

  const billing = readAddress(form, "billing");
  const delivery = form.get("same_as_billing") ? billing : readAddress(form, "delivery");

  let orderId: string;
  try {
    const order = await withLoginRedirect(() =>
      createOrder(
        {
          items: [{ product_id: String(form.get("product_id") ?? ""), quantity: 1 }],
          billing_address: billing,
          delivery_address: delivery,
        },
        idempotencyKey,
      ),
    );
    orderId = order.order_id;
  } catch (e) {
    // 409 (product unavailable) and 422 (validation) problems show their title/detail
    return fail(problemMessage(e, "The order could not be created. Please try again later.", "Create order failed"));
  }
  redirect(`/orders/checkout/payment?order=${encodeURIComponent(orderId)}`);
}
