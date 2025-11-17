"use server";

import { db } from "@/database/drizzle";
import { currencies, currencyHistory } from "@/database/schema";
import { eq, desc } from "drizzle-orm";


export async function getCurrencyByCode(currencyCode: string) {
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



export async function getActiveCurrencies() {
  return await db.query.currencies.findMany({
    where: eq(currencies.isActive, true),
    orderBy: currencies.code,
  });
}



export async function updateExchangeRate(
  currencyCode: string,
  newRate: string,
  updatedBy: string
) {
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
    const [updated] = await tx
      .update(currencies)
      .set({
        exchangeRate: newRate,
        updatedAt: new Date(),
      })
      .where(eq(currencies.id, currency.id))
      .returning();

    return {
      success: true,
      oldRate: currency.exchangeRate,
      newRate: updated.exchangeRate,
      currency: updated,
    };
  });
}



export async function convertCurrency(priceDkkInCents: number, targetCountryCode: string) {
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



export async function getLocalCurrencyString(priceDkkInCents: number, targetCountryCode: string) {
  const country = targetCountryCode.toUpperCase();

  // If Danish, return DKK
  if (country === "DKK" || country === "DK") {
    const price = priceDkkInCents / 100;
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


 

export async function getCurrencyHistory(currencyCode: string, limit: number = 50) {
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
  code: string,
  exchangeRate: string,
  isActive: boolean = true
) {
  const [currency] = await db
    .insert(currencies)
    .values({
      code: code.toUpperCase(),
      exchangeRate,
      isActive,
      updatedAt: new Date(),
    })
    .returning();

  return currency;
}



export async function toggleCurrencyStatus(currencyCode: string, isActive: boolean) {
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



// // ============================================
// // Usage Examples
// // ============================================

// // Example 1: Get EUR price for a product
// async function displayProductPrice(productPriceDkk: number, userCountry: string) {
//   const currencyCode = userCountry === "DK" ? "DKK" : "EUR";
  
//   if (currencyCode === "DKK") {
//     return `${productPriceDkk} DKK`;
//   }

//   const priceInEur = await currencyService.convertPrice(productPriceDkk, "EUR");
//   return `€${priceInEur.toFixed(2)}`;
// }

// // Example 2: Create an order with currency snapshot
// async function createOrder(userId: number, totalDkk: number, userCountry: string) {
//   const currencyCode = userCountry === "DK" ? "DKK" : "EUR";
  
//   let exchangeRate = "1.000000";
//   let totalInCurrency = totalDkk;

//   if (currencyCode !== "DKK") {
//     const currency = await currencyService.getCurrentRate(currencyCode);
//     exchangeRate = currency.exchangeRate;
//     totalInCurrency = await currencyService.convertPrice(totalDkk, currencyCode);
//   }

//   const [order] = await db.insert(orders).values({
//     userId,
//     status: "pending",
//     currencyCode,
//     exchangeRateUsed: exchangeRate,
//     totalPriceDkk: totalDkk.toFixed(2),
//     totalPriceCurrency: totalInCurrency.toFixed(2),
//     createdAt: new Date(),
//   }).returning();

//   return order;
// }

// // Example 3: Admin updates EUR exchange rate
// async function adminUpdateRate() {
//   const result = await currencyService.updateExchangeRate(
//     "EUR",
//     "0.138000", // New rate
//     "admin@example.com"
//   );

//   console.log(`Rate updated from ${result.oldRate} to ${result.newRate}`);
// }

// // Example 4: View rate change history
// async function viewRateHistory() {
//   const history = await currencyService.getCurrencyHistory("EUR", 10);
  
//   history.forEach(record => {
//     console.log(
//       `${record.changedAt.toISOString()}: ${record.exchangeRate} (by ${record.changedBy})`
//     );
//   });
// }