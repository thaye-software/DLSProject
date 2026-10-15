export type Money = {
  amount_minor: number;
  currency: string;
};

const MINOR_UNITS_PER_MAJOR = 100;

export function formatMoney({ amount_minor, currency }: Money): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(amount_minor / MINOR_UNITS_PER_MAJOR);
}
