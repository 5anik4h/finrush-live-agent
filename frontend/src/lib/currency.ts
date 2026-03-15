export type Currency = "USD" | "EUR" | "GBP";

export const CURRENCIES: { value: Currency; symbol: string; label: string; flag: string }[] = [
  { value: "USD", symbol: "$", label: "Dollar", flag: "🇺🇸" },
  { value: "EUR", symbol: "€", label: "Euro", flag: "🇪🇺" },
  { value: "GBP", symbol: "£", label: "Pound", flag: "🇬🇧" },
];

export const CURRENCY_NAMES_ES: Record<Currency, string> = {
  USD: "Dólar",
  EUR: "Euro",
  GBP: "Libra",
};

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCIES.find((c) => c.value === currency)?.symbol ?? "$";
}

// Format a number in the given currency using locale-aware formatting.
// EUR uses de-DE locale so the symbol appears after the number (e.g. "1.200,00 €").
// USD and GBP use en-US locale so the symbol appears before (e.g. "$1,200.00", "£1,200.00").
// CRITICAL: Preserves negative sign for negative amounts (e.g. "-$250.00", "-1.200,00 €").
export function fmtCurrency(amount: number, currency: Currency, decimals = 2): string {
  const locale = currency === "EUR" ? "de-DE" : "en-US";
  const safeDecimals = Math.min(decimals, 4);
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Math.min(2, safeDecimals),
    maximumFractionDigits: safeDecimals,
  }).format(absAmount);
  return isNegative ? `-${formatted}` : formatted;
}

// Approximate static fallback rates (USD base). Used only when live rates are unavailable.
// The agent fetches live rates via Google Search for real conversions.
export const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

// Convert an amount from USD to the target currency using provided rates
export function convertFromUSD(amount: number, to: Currency, rates: Record<Currency, number>): number {
  if (to === "USD") return amount;
  return amount * rates[to];
}

// Convert an amount from the source currency to USD using provided rates
export function convertToUSD(amount: number, from: Currency, rates: Record<Currency, number>): number {
  if (from === "USD") return amount;
  const rate = rates[from] || 1;
  return amount / rate;
}

// ─── Regla de oro: 2 decimales ───────────────────────────────────────────────
// All monetary amounts must be rounded to 2 decimal places before being sent
// to the backend or stored in Supabase. Backend trusts these values as-is.
// Rounding rule: standard half-up (Math.round). Always use this function for
// amounts before any API call or Supabase mutation.
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
