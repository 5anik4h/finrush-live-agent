// Domain types shared between services, hooks, and components

export interface Transaction {
  id: string;
  short_id: number;
  amount: number;
  currency?: string;
  amount_usd?: number;
  rate_at_entry?: number;
  date: string;
  description: string;
  type: "income" | "expense";
  category: string;
  user_id?: string;
}

export interface Investment {
  id: string;
  short_id?: number;
  asset_type: string;
  name: string;
  // Normalized financial fields
  invested_amount: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  // Raw row data (asset-type specific)
  raw: Record<string, unknown>;
}

export interface InvestmentSummary {
  id: string;
  quantity: number;
  buy_price: number;
  current_price: number;
}

export interface Budget {
  id: string;
  short_id?: number;
  user_id: string;
  name: string;
  type: string;
  amount: number;
  amount_usd?: number;
  rate_at_entry?: number;
  categories: string[];
  date_from: string | null;
  date_to: string | null;
  recurrence?: string;
  currency?: string;
  created_at: string;
}

export interface SavingsPot {
  id: string;
  short_id?: number;
  name: string;
  current_balance: number;
  current_balance_usd?: number;
  target_amount: number | null;
  target_amount_usd?: number;
  rate_at_entry?: number;
  categories?: string[];
  currency?: string;
}

export interface SavingsContribution {
  id: string;
  pot_id?: string;
  amount: number;
  currency?: string;
  amount_usd?: number;
  rate_at_entry?: number;
  type?: "deposit" | "withdrawal";
  note: string | null;
  date: string;
  created_at: string;
}

export interface MonthlySnapshot {
  year: number;
  month: number;
  balance: number;
  investment_value: number;
  savings_value: number;
  net_worth: number;
}

export interface ExchangeRate {
  currency: string;
  rate_vs_usd: number;
  updated_at: string;
}
