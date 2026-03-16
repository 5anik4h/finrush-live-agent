import { createClient } from "@/lib/supabase";
import type { InvestmentSummary } from "@/types";
import { refreshMetrics } from "./metrics";
import { normalise } from "@/lib/investment-normalize";
import type { AssetType } from "@/lib/categories";

// Mirrors backend ASSET_TABLE_MAP (10 types in canonical order)
export const TABLE_MAP: Record<string, string> = {
  stock: "inv_stocks",
  commodity: "inv_commodities",
  crypto: "inv_crypto",
  etf: "inv_etfs",
  fund: "inv_funds",
  fixedincome: "inv_fixedincome",
  crowdlending: "inv_crowdlending",
  realestate: "inv_realestate",
  forex: "inv_forex",
  account: "inv_accounts",
};

function getClient() {
  return createClient();
}

/**
 * Compound interest calculation (same formula as backend).
 * Returns accrued interest (not total).
 */
export function calcCompoundInterest(
  principal: number,
  apy: number,
  frequency: string,
  startDateStr: string
): number {
  const PERIODS: Record<string, number> = {
    daily: 365, weekly: 52, monthly: 12, quarterly: 4, annual: 1,
  };
  try {
    const start = new Date(startDateStr + "T00:00:00Z");
    const now = new Date();
    const t = (now.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (t <= 0 || principal <= 0 || apy <= 0) return 0;
    const n = PERIODS[frequency] ?? 12;
    const r = apy / 100;
    return principal * (Math.pow(1 + r / n, n * t) - 1);
  } catch {
    return 0;
  }
}

/**
 * Fetch all investments aggregated from 10 tables as simple summary objects
 * for use in SummaryTab KPIs (quantity × price model).
 */
export async function getInvestmentsSummary(
  userId: string
): Promise<InvestmentSummary[]> {
  const supabase = getClient();
  const all: InvestmentSummary[] = [];

  // Group A — qty × price model (stock, crypto, commodity)
  for (const tbl of ["inv_stocks", "inv_crypto", "inv_commodities"]) {
    const { data } = await supabase
      .from(tbl)
      .select("id, quantity, buy_price, current_price")
      .eq("user_id", userId);
    if (data) {
      for (const row of data) {
        all.push({
          id: row.id,
          quantity: Number(row.quantity ?? 0),
          buy_price: Number(row.buy_price ?? 0),
          current_price: Number(row.current_price ?? row.buy_price ?? 0),
        });
      }
    }
  }

  // ETFs use "quantity" column (unified schema - Session 68)
  const { data: etfs } = await supabase
    .from("inv_etfs")
    .select("id, quantity, buy_price, current_price")
    .eq("user_id", userId);
  if (etfs) {
    for (const row of etfs) {
      all.push({
        id: row.id,
        quantity: Number(row.quantity ?? 0),
        buy_price: Number(row.buy_price ?? 0),
        current_price: Number(row.current_price ?? row.buy_price ?? 0),
      });
    }
  }

  // Funds: quantity × buy_price / current_value (unified schema - Session 68)
  const { data: funds } = await supabase
    .from("inv_funds")
    .select("id, quantity, buy_price, current_value, current_value_usd")
    .eq("user_id", userId);
  if (funds) {
    for (const f of funds) {
      const invested = Number(f.quantity ?? 1) * Number(f.buy_price ?? 0);
      all.push({
        id: f.id,
        quantity: 1,
        buy_price: invested,
        current_price: Number(f.current_value ?? f.current_value_usd ?? invested),
      });
    }
  }

  // Group B — quantity + compound interest (unified schema - Session 68)
  for (const tbl of ["inv_fixedincome", "inv_accounts"]) {
    const { data } = await supabase
      .from(tbl)
      .select("id, quantity, apy, frequency, start_date")
      .eq("user_id", userId);
    if (data) {
      for (const row of data) {
        const principal = Number(row.quantity ?? 0);
        const interest = calcCompoundInterest(
          principal,
          Number(row.apy ?? 0),
          row.frequency ?? "monthly",
          row.start_date ?? new Date().toISOString().slice(0, 10)
        );
        all.push({
          id: row.id,
          quantity: 1,
          buy_price: principal,
          current_price: principal + interest,
        });
      }
    }
  }

  // Crowdlending: quantity + accumulated_interest (unified schema - Session 68)
  const { data: cl } = await supabase
    .from("inv_crowdlending")
    .select("id, quantity, apy, frequency, start_date, accumulated_interest, accumulated_interest_usd")
    .eq("user_id", userId);
  if (cl) {
    for (const c of cl) {
      const cap = Number(c.quantity ?? 0);
      const accrued = calcCompoundInterest(
        cap,
        Number(c.apy ?? 0),
        c.frequency ?? "monthly",
        c.start_date ?? new Date().toISOString().slice(0, 10)
      );
      const interest = Math.max(Number(c.accumulated_interest ?? c.accumulated_interest_usd ?? 0), accrued);
      all.push({
        id: c.id,
        quantity: 1,
        buy_price: cap,
        current_price: cap + interest,
      });
    }
  }

  // Real estate: estimated_value - pending_mortgage
  const { data: re } = await supabase
    .from("inv_realestate")
    .select("id, estimated_value, pending_mortgage, purchase_price")
    .eq("user_id", userId);
  if (re) {
    for (const r of re) {
      const equity = Number(r.estimated_value ?? 0) - Number(r.pending_mortgage ?? 0);
      const invested = Number(r.purchase_price ?? r.estimated_value ?? 0);
      all.push({
        id: r.id,
        quantity: 1,
        buy_price: invested,
        current_price: equity,
      });
    }
  }

  // Forex: quantity_usd (liquidity store, unified schema - Session 68)
  const { data: fx } = await supabase
    .from("inv_forex")
    .select("id, quantity, quantity_usd, currency")
    .eq("user_id", userId);
  if (fx) {
    for (const f of fx) {
      const value = Number(f.quantity_usd ?? f.quantity ?? 0);
      all.push({
        id: f.id,
        quantity: 1,
        buy_price: value,
        current_price: value,
      });
    }
  }

  return all;
}

/**
 * Fetch all investments from a specific asset-type table (raw rows).
 */
export async function getInvestmentsByType(
  userId: string,
  assetType: string
): Promise<Record<string, unknown>[]> {
  const supabase = getClient();
  const table = TABLE_MAP[assetType];
  if (!table) throw new Error(`Unknown asset type: ${assetType}`);

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch ${assetType}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Fetch and compute total current investment value (in USD) for all asset types.
 * Uses the same normalise() logic as InvestmentsTab to ensure consistency.
 *
 * This is used by SummaryTab to display "Inversión" KPI.
 */
export async function getNormalizedInvestmentValue(userId: string): Promise<number> {
  try {
    const assetTypesList: AssetType[] = [
      "stock",
      "crypto",
      "commodity",
      "etf",
      "fund",
      "fixedincome",
      "account",
      "crowdlending",
      "realestate",
      "forex",
    ];

    let totalCurrentValue = 0;

    for (const assetType of assetTypesList) {
      try {
        const rows = await getInvestmentsByType(userId, assetType);
        for (const row of rows) {
          const normalized = normalise(assetType, row);
          totalCurrentValue += normalized.current_value;
        }
      } catch (err) {
        console.warn(`Failed to fetch ${assetType} for investment value calculation:`, err);
        // Continue with next asset type on error
      }
    }

    return Number(totalCurrentValue.toFixed(2));
  } catch (err) {
    console.error("getNormalizedInvestmentValue failed:", err);
    return 0;
  }
}

/**
 * Update current_price for a priceable investment row.
 */
export async function updateInvestmentPrice(
  assetType: string,
  id: string,
  price: number
): Promise<void> {
  const supabase = getClient();
  const table = TABLE_MAP[assetType];
  if (!table) throw new Error(`Unknown asset type: ${assetType}`);

  const { error } = await supabase
    .from(table)
    .update({ current_price: Number(price.toFixed(4)) })
    .eq("id", id);
  if (error) throw new Error(`Failed to update price: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}

/**
 * Update accumulated_interest and last_calc_at for a Group B investment.
 */
export async function updateGroupBInterest(
  assetType: string,
  id: string,
  accumulated_interest: number,
  principal?: number
): Promise<void> {
  const supabase = getClient();
  const table = TABLE_MAP[assetType];
  if (!table) throw new Error(`Unknown asset type: ${assetType}`);

  const patch: Record<string, unknown> = {
    accumulated_interest: Number(accumulated_interest.toFixed(4)),
    last_calc_at: new Date().toISOString(),
  };
  if (principal !== undefined) patch.principal = Number(principal.toFixed(4));

  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update interest: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}

/**
 * Insert a new investment row.
 */
export async function insertInvestment(
  assetType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getClient();
  const table = TABLE_MAP[assetType];
  if (!table) throw new Error(`Unknown asset type: ${assetType}`);

  // Apply rounding to numeric fields in payload before insertion
  const roundedPayload = { ...payload };
  for (const key of Object.keys(roundedPayload)) {
    if (typeof roundedPayload[key] === 'number') {
      roundedPayload[key] = Number((roundedPayload[key] as number).toFixed(4));
    }
  }

  const { error } = await supabase.from(table).insert(roundedPayload);
  if (error) throw new Error(`Failed to insert investment: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}

/**
 * Update an existing investment row.
 */
export async function updateInvestment(
  assetType: string,
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getClient();
  const table = TABLE_MAP[assetType];
  if (!table) throw new Error(`Unknown asset type: ${assetType}`);

  // Apply rounding to numeric fields in payload before update
  const roundedPayload = { ...payload };
  for (const key of Object.keys(roundedPayload)) {
    if (typeof roundedPayload[key] === 'number') {
      roundedPayload[key] = Number((roundedPayload[key] as number).toFixed(4));
    }
  }

  const { error } = await supabase.from(table).update(roundedPayload).eq("id", id);
  if (error) throw new Error(`Failed to update investment: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}

/**
 * Delete an investment row.
 */
export async function deleteInvestment(
  assetType: string,
  id: string
): Promise<void> {
  const supabase = getClient();
  const table = TABLE_MAP[assetType];
  if (!table) throw new Error(`Unknown asset type: ${assetType}`);

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(`Failed to delete investment: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}
