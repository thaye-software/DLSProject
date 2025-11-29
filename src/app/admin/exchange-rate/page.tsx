"use client";

import ExchangeRateSubmitButton from "@/components/Admin/ExchangeRateSubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";
import { getCurrencyByCode, updateExchangeRate } from "@/services/currencyService";
import { useEffect, useState } from "react";

export default function ExchangeRatePage() {
  const { username } = useSupabaseAuthContext();
  const [roundedRate, setRoundedRate] = useState("Fetching...");

  useEffect(() => {
    async function fetchEURRate() {
      const currency = await getCurrencyByCode("EUR");
      setRoundedRate(parseFloat(currency.exchangeRate).toFixed(4));
    }
    fetchEURRate();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Exchange Rate Settings</h1>
      <div className="flex flex-row">
        <form action={updateExchangeRate}>
          <Input type="hidden" name="username" value={username || ""}></Input>
          <Input type="hidden" name="currencyCode" value="EUR"></Input>
          <Label htmlFor="exchangeRate" className="mb-2 block">
            Current Exchange Rate (DKK to EUR)
          </Label>
          <Input
            id="exchangeRate"
            name="exchangeRate"
            className="max-w-sm mb-4"
            value={roundedRate}
            onChange={(e) => setRoundedRate(e.target.value)}
          />
          <ExchangeRateSubmitButton />
        </form>
      </div> 
    </div>
  );
}