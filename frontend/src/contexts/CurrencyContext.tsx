"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  type Currency,
  FALLBACK_RATES,
  convertFromUSD,
  fmtCurrency,
} from "@/lib/currency";
import { getExchangeRates } from "@/services/rates";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Record<Currency, number>;
  refetchRates: () => Promise<void>;
  fmt: (amount: number, decimals?: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getSavedCurrency(): Currency {
  if (typeof window === "undefined") return "USD";
  const saved = localStorage.getItem("finrush_currency");
  if (saved === "USD" || saved === "EUR" || saved === "GBP") return saved;
  return "USD";
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(getSavedCurrency);
  const [rates, setRates] = useState<Record<Currency, number>>(FALLBACK_RATES);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("finrush_currency", c);
  }, []);

  const refetchRates = useCallback(async () => {
    const newRates = await getExchangeRates();
    setRates(newRates);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => refetchRates(), 0);
    return () => clearTimeout(timer);
  }, [refetchRates]);

  const fmt = useMemo(
    () =>
      (amount: number, decimals = 2) =>
        fmtCurrency(convertFromUSD(amount, currency, rates), currency, decimals),
    [currency, rates]
  );

  const value = useMemo(
    () => ({ currency, setCurrency, rates, refetchRates, fmt }),
    [currency, setCurrency, rates, refetchRates, fmt]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
