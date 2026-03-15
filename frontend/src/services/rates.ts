import { createClient } from "@/lib/supabase";
import type { Currency } from "@/lib/currency";
import { FALLBACK_RATES } from "@/lib/currency";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

function getClient() {
  return createClient();
}

/**
 * Fetch exchange rates:
 * 1. Supabase DB (Manual control)
 * 2. Backend API fallback
 * 3. Static FALLBACK_RATES
 */
export async function getExchangeRates(): Promise<Record<Currency, number>> {
  // 1. Try DB
  try {
    const supabase = getClient();
    const { data } = await supabase
      .from("exchange_rates")
      .select("currency, rate_vs_usd");
    
    if (data && data.length > 0) {
      const cached: Record<string, number> = {};
      for (const row of data) {
        cached[row.currency] = Number(row.rate_vs_usd);
      }
      if (cached.EUR && cached.GBP) {
        return { USD: 1, EUR: cached.EUR, GBP: cached.GBP };
      }
    }
  } catch {
    // DB read failed
  }

  // 2. Try backend API as fallback
  try {
    const res = await fetch(`${API_URL}/rates`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const d = await res.json();
      return {
        USD: d.USD ?? 1,
        EUR: d.EUR ?? 0.92,
        GBP: d.GBP ?? 0.79,
      };
    }
  } catch {
    // API failed
  }

  return { ...FALLBACK_RATES };
}
