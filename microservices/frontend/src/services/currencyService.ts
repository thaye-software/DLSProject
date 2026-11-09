"use server";

import { db } from "@/database/drizzle";
import { currencies, currencyHistory } from "@/database/schema";
import { eq, desc } from "drizzle-orm";
import { CurrencyHistoryModel, CurrencyModel, NewCurrencyModel } from "@/database/types";
import { getCountryVATByCode } from "./countryService";


export async function getCurrencyByCode(currencyCode: string): Promise<CurrencyModel> {
  const currency = await db.query.currencies.findFirst({
    where: eq(currencies.code, currencyCode.toUpperCase()),
  });

  if (!currency) {
    throw new Error(`Currency ${currencyCode} not found`);
  }

  if (!currency.isActive) {
    throw new Error(`Currency ${currencyCode} is not active`);
  }

  return currency;
}

export async function getActiveCurrencies(): Promise<CurrencyModel[]> {
  return await db.query.currencies.findMany({
    where: eq(currencies.isActive, true),
    orderBy: currencies.code,
  });
}

export async function updateExchangeRate(
  formData: FormData
): Promise<void> {
  const currencyCode = formData.get("currencyCode") as string;
  const newRate = formData.get("exchangeRate") as string;
  const updatedBy = formData.get("username") as string;
  return await db.transaction(async (tx) => {
    // 1. Get current currency
    const currency = await tx.query.currencies.findFirst({
      where: eq(currencies.code, currencyCode.toUpperCase()),
    });

    if (!currency) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    // 2. Save old rate to history
    await tx.insert(currencyHistory).values({
      currencyId: currency.id,
      exchangeRate: currency.exchangeRate,
      changedAt: new Date(),
      changedBy: updatedBy,
    });

    // 3. Update to new rate
    await tx
      .update(currencies)
      .set({
        exchangeRate: newRate,
        updatedAt: new Date(),
      })
      .where(eq(currencies.id, currency.id))
  });
}

export async function convertCurrencyReturnCents(priceDkk: number, targetCountryCode: string): Promise<number> {
  const country = targetCountryCode.toUpperCase();

  // If Danish, return DKK
  if (country === "DKK" || country === "DK") {
    const convertedPrice = priceDkk;
    return convertedPrice;
  }

  try {
    // For all non-DK users, use EUR
    const targetCurrencyCode = "EUR"; // Requirement: non-DK users see EUR
    const { exchangeRate } = await getCurrencyByCode(targetCurrencyCode);
    const rate = parseFloat(exchangeRate);
    
    const convertedPrice = priceDkk * rate;
    return Math.round(convertedPrice);

  } catch (error) {
    console.error("(Server) Error getting exchange rate", error);
    throw error;
  }
}


export async function convertCurrency(priceDkkInCents: number, targetCountryCode: string): Promise<number> {
  const country = targetCountryCode.toUpperCase();

  // If Danish, return DKK
  if (country === "DKK" || country === "DK") {
    const convertedPrice = priceDkkInCents / 100;
    return convertedPrice;
  }

  try {
    // For all non-DK users, use EUR
    const targetCurrencyCode = "EUR"; // Requirement: non-DK users see EUR
    const { exchangeRate } = await getCurrencyByCode(targetCurrencyCode);
    const rate = parseFloat(exchangeRate);
    
    const convertedPrice = (priceDkkInCents * rate) / 100;
    return convertedPrice;

  } catch (error) {
    console.error("(Server) Error getting exchange rate", error);
    throw error;
  }
}

export async function getLocalCurrencyString(priceDkkInCents: number, targetCountryCode: string): Promise<string> {
  const country = targetCountryCode.toUpperCase();

  // If Danish, return DKK
  if (country === "DKK" || country === "DK") {
    const price = (priceDkkInCents) / 100;
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
    }).format(price);
  }

  try {
    // For all non-DK users, use EUR
    const targetCurrencyCode = "EUR"; // Requirement: non-DK users see EUR
    const { exchangeRate } = await getCurrencyByCode(targetCurrencyCode);
    
    const rate = parseFloat(exchangeRate);
    const convertedPrice = (priceDkkInCents * rate) / 100;
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: targetCurrencyCode,
    }).format(convertedPrice);

  } catch (error) {
    console.error("(Server) Error getting exchange rate", error);
    throw error;
  }
}


 

export async function getCurrencyHistory(currencyCode: string, limit: number = 50): Promise<CurrencyHistoryModel[]> {
  const currency = await db.query.currencies.findFirst({
    where: eq(currencies.code, currencyCode.toUpperCase()),
  });

  if (!currency) {
    throw new Error(`Currency ${currencyCode} not found`);
  }

  return await db.query.currencyHistory.findMany({
    where: eq(currencyHistory.currencyId, currency.id),
    orderBy: desc(currencyHistory.changedAt),
    limit,
  });
}



export async function createCurrency(
  newCurrency: NewCurrencyModel
): Promise<CurrencyModel> {
  const [currency] = await db
    .insert(currencies)
    .values({
      code: newCurrency.code.toUpperCase(),
      exchangeRate: newCurrency.exchangeRate,
      isActive: newCurrency.isActive,
      updatedAt: new Date(),
    })
    .returning();

  return currency;
}



export async function toggleCurrencyStatus(currencyCode: string, isActive: boolean): Promise<CurrencyModel> {
  const [updated] = await db
    .update(currencies)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(currencies.code, currencyCode.toUpperCase()))
    .returning();

  return updated;
}
