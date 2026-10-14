"use server";
import { NextResponse } from "next/server";
import { convertCurrency } from "@/services/currencyService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const priceDkkInCents = Number(body.priceDkkInCents ?? body.price ?? 0);
    const target = (body.target || "EUR").toUpperCase();

    if (!priceDkkInCents || Number.isNaN(priceDkkInCents)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // convertCurrency returns a number (decimal) for the target currency
    const amount = await convertCurrency(priceDkkInCents, target);

    return NextResponse.json({ amount });
  } catch (err: any) {
    console.error("Currency convert error:", err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
