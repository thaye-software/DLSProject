import {
  calculateVatCents,
  calculateSubtotalCents,
  calculateShippingCents,
  calculateTotalCents,
} from "@/lib/priceUtils";

describe("priceUtils calculations", () => {
  it("calculates VAT, subtotal and total correctly for typical values", () => {
    // net is 1.000,00 DKK -> 1000 DKK * 100 = 100000 cents
    const netCents = 1000 * 100;
    const vatPercent = 25; // 25% VAT
    const shippingDkk = 300; // 300 DKK

    const vat = calculateVatCents(netCents, vatPercent);
    expect(vat).toBe(25000); // 250,00 DKK

    const subtotal = calculateSubtotalCents(netCents, vatPercent);
    expect(subtotal).toBe(125000); // 1.250,00 DKK

    const shipping = calculateShippingCents(shippingDkk);
    expect(shipping).toBe(30000); // 300,00 DKK

    const total = calculateTotalCents(netCents, vatPercent, shippingDkk);
    expect(total).toBe(155000); // 1.550,00 DKK
  });

  it("rounds VAT correctly when needed", () => {
    const netCents = 999; // 9,99 DKK
    const vatPercent = 25;

    const vat = calculateVatCents(netCents, vatPercent);
    // 999 * 0.25 = 249.75 -> rounds to 250 cents
    expect(vat).toBe(250);
  });
});
