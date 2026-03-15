import { createClient } from "@/lib/supabase";
import { normalizeCategory } from "@/lib/categories";
import { getExchangeRates } from "./rates";
import type { Currency } from "@/lib/currency";
import type { Transaction } from "@/types";

import { refreshMetrics } from "./metrics";

function getClient() {
  return createClient();
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
  return (data ?? []) as Transaction[];
}

export async function addTransaction(
  userId: string,
  payload: {
    amount: number;
    description: string;
    category: string;
    type: "income" | "expense";
    date: string;
    currency?: string;
  }
): Promise<void> {
  const supabase = getClient();
  const rates = await getExchangeRates();
  const curr = (payload.currency || "USD") as Currency;
  const rate_at_entry = Number((rates[curr] || 1).toFixed(4));
  const amount_usd = Number((payload.amount / rate_at_entry).toFixed(4));

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    amount: Number(payload.amount.toFixed(4)),
    description: payload.description || "-",
    category: normalizeCategory(payload.category),
    type: payload.type,
    date: payload.date,
    currency: curr,
    amount_usd,
    rate_at_entry,
  });
  if (error) throw new Error(`Failed to add transaction: ${error.message}`);

  if (token) {
    refreshMetrics(userId, token);
  }
}

export async function updateTransaction(
  id: string,
  payload: {
    amount: number;
    description: string;
    category: string;
    type: string;
    date: string;
    currency?: string;
  }
): Promise<void> {
  const supabase = getClient();
  const rates = await getExchangeRates();
  const curr = (payload.currency || "USD") as Currency;
  const rate_at_entry = Number((rates[curr] || 1).toFixed(4));
  const amount_usd = Number((Math.abs(payload.amount) / rate_at_entry).toFixed(4));

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;

  const { error } = await supabase
    .from("transactions")
    .update({
      amount: Number(Math.abs(payload.amount).toFixed(4)),
      description: payload.description || "-",
      category: normalizeCategory(payload.category),
      type: payload.type,
      date: payload.date,
      currency: curr,
      amount_usd,
      rate_at_entry,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update transaction: ${error.message}`);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = getClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete transaction: ${error.message}`);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}
