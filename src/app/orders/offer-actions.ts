"use server";

import { createOfferToken } from "@/services/offerService";
import { getCurrencyByCode } from "@/services/currencyService";

export async function generateOfferLink(
  productSlug: string,
  amount: number,
  currency: "DKK" | "EUR"
) {
  let priceDkkCents: number;

  if (currency === "DKK") {
    // amount is decimal DKK, e.g. 100.50 -> 10050 cents
    priceDkkCents = Math.round(amount * 100);
  } else {
    // amount is decimal EUR, e.g. 10.00
    // We need to convert EUR to DKK cents.
    // Rate is DKK -> EUR (e.g. 0.134)
    // So EUR -> DKK is amount / rate
    const { exchangeRate } = await getCurrencyByCode("EUR");
    const rate = parseFloat(exchangeRate);
    // amount is units, so convert to DKK units then to cents
    const priceDkkDecimal = amount / rate;
    priceDkkCents = Math.round(priceDkkDecimal * 100);
  }

  const token = await createOfferToken(productSlug, priceDkkCents);
  return `/orders/checkout/infomation?product=${encodeURIComponent(
    productSlug
  )}&offer=${token}`;
}
