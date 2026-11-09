import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("formats minor units as da-DK currency", () => {
    const out = formatMoney({ amount_minor: 11500000, currency: "DKK" });
    expect(out).toContain("115.000,00");
    expect(out).toContain("kr");
  });
});
