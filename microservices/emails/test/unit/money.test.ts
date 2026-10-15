import { describe, expect, it } from "vitest";
import { formatMoney } from "../../src/domain/money.js";

describe("formatMoney", () => {
  it.each([
    { name: "zero (BV)", money: { amount_minor: 0, currency: "DKK" }, text: "0,00 kr." },
    { name: "one øre (BV)", money: { amount_minor: 1, currency: "DKK" }, text: "0,01 kr." },
    { name: "99 øre, below one krone (BV)", money: { amount_minor: 99, currency: "DKK" }, text: "0,99 kr." },
    { name: "one krone (BV)", money: { amount_minor: 100, currency: "DKK" }, text: "1,00 kr." },
    { name: "shipping (EP)", money: { amount_minor: 30000, currency: "DKK" }, text: "300,00 kr." },
    { name: "watch price with thousands separator (EP)", money: { amount_minor: 11500000, currency: "DKK" }, text: "115.000,00 kr." },
    { name: "another currency keeps its own symbol (EP)", money: { amount_minor: 1250, currency: "EUR" }, text: "12,50 €" },
  ])("$name", ({ money, text }) => {
    expect(formatMoney(money)).toBe(text);
  });
});
