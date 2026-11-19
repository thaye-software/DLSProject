export type Money = { amount_minor: number; currency: string };

export function formatMoney({ amount_minor, currency }: Money): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(amount_minor / 100);
}
