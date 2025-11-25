export function calculateVatCents(
  netCents: number,
  vatPercent: number
): number {
  return Math.round((netCents * vatPercent) / 100);
}

export function calculateSubtotalCents(
  netCents: number,
  vatPercent: number
): number {
  const vat = calculateVatCents(netCents, vatPercent);
  return netCents + vat;
}

export function calculateShippingCents(shippingPriceDkk: number): number {
  // shippingPriceDkk is in DKK units (e.g. 300), convert to cents
  return Math.round(shippingPriceDkk * 100);
}

export function calculateTotalCents(
  netCents: number,
  vatPercent: number,
  shippingPriceDkk: number
): number {
  const subtotal = calculateSubtotalCents(netCents, vatPercent);
  const shipping = calculateShippingCents(shippingPriceDkk);
  return subtotal + shipping;
}

export function calculateVAT(amount: number, vatRate: number): number {
  return Math.round((amount * vatRate) / 100);
}

export default {
  calculateVatCents,
  calculateSubtotalCents,
  calculateShippingCents,
  calculateTotalCents,
  calculateVAT,
};
