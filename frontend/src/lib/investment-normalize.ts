/**
 * investment-normalize.ts
 *
 * Shared normalization logic for investments.
 * Converts raw investment rows from any of the 10 asset types into a unified InvRow format.
 * All monetary values are normalized to USD so that display formatting works correctly.
 *
 * Schema (Session 68):
 * - Group A (stock/crypto/etf/commodity): quantity, buy_price_usd, current_price_usd
 * - Group B (fixedincome/account/crowdlending): quantity, quantity_usd, apy, accumulated_interest_usd
 * - Fund: quantity, buy_price_usd, current_value_usd
 * - Forex: quantity, quantity_usd
 * - RealEstate: unchanged
 */

import { type AssetType } from "@/lib/categories";
import { type InvRow } from "@/components/dashboard/investments/InvestmentTable";
import { calcCompoundInterest } from "@/services/investments";

/**
 * Normalise raw investment row to unified InvRow format.
 * All monetary fields in InvRow are in USD.
 */
export function normalise(type: AssetType, row: Record<string, unknown>): InvRow {
  let invested = 0;
  let current = 0;
  const name = String(row.name ?? row.ticker ?? "—");

  switch (type) {
    case "stock":
    case "crypto":
    case "commodity":
    case "etf": {
      // Group A unified: all use 'quantity' column (etf was 'shares', now renamed)
      const qty = Number(row.quantity ?? 0);
      const bpUsd = Number(row.buy_price_usd ?? row.buy_price ?? 0);
      const cpUsd = Number(row.current_price_usd ?? row.current_price) || bpUsd;
      invested = qty * bpUsd;
      current = qty * cpUsd;
      break;
    }
    case "fund": {
      // Fund: quantity × buy_price; current_value stored separately
      const qty = Number(row.quantity ?? 0);
      const bpUsd = Number(row.buy_price_usd ?? row.buy_price ?? 0);
      const cv = Number(row.current_value_usd ?? row.current_value ?? qty * bpUsd);
      invested = qty * bpUsd;
      current = cv;
      break;
    }
    case "fixedincome":
    case "account":
    case "crowdlending": {
      // Group B unified: all use 'quantity' / 'quantity_usd' (replaces principal/capital)
      const qtyUsd = Number(row.quantity_usd ?? row.quantity ?? 0);
      const qty = Number(row.quantity ?? qtyUsd);
      const interest = calcCompoundInterest(
        qty,
        Number(row.apy ?? 0),
        String(row.frequency ?? "monthly"),
        String(row.start_date ?? new Date().toISOString().slice(0, 10))
      );
      const ratio = qty > 0 ? qtyUsd / qty : 1;
      // Prefer stored accumulated_interest_usd over calculated
      const storedUsd = row.accumulated_interest_usd != null
        ? Number(row.accumulated_interest_usd)
        : interest * ratio;
      invested = qtyUsd;
      current = qtyUsd + storedUsd;
      break;
    }
    case "realestate":
      invested = Number(row.purchase_price_usd ?? row.purchase_price ?? row.estimated_value_usd ?? row.estimated_value ?? 0);
      current = Number(row.estimated_value_usd ?? row.estimated_value ?? 0) - Number(row.pending_mortgage_usd ?? row.pending_mortgage ?? 0);
      break;
    case "forex": {
      // Forex: quantity_usd replaces amount_usd
      const qty = Number(row.quantity_usd ?? row.quantity ?? 0);
      invested = qty;
      current = qty;
      break;
    }
  }

  const pnl = current - invested;
  const pnl_pct = invested > 0 ? (pnl / invested) * 100 : 0;
  return {
    id: String(row.id ?? ""),
    short_id: Number(row.short_id ?? 0),
    asset_type: type,
    name,
    invested_amount: invested,
    current_value: current,
    pnl,
    pnl_pct,
    raw: row,
  };
}
