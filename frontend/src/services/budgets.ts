import { createClient } from "@/lib/supabase";
import { getExchangeRates } from "./rates";
import type { Currency } from "@/lib/currency";
import type { Budget } from "@/types";
import { refreshMetrics } from "./metrics";

function getClient() {
  return createClient();
}

export async function getBudgets(userId: string): Promise<Budget[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .order("date_from", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Failed to fetch budgets: ${error.message}`);
  return (data ?? []) as Budget[];
}

export async function addBudget(
  userId: string,
  payload: Omit<Budget, "id" | "user_id" | "created_at">
): Promise<void> {
  const supabase = getClient();
  const rates = await getExchangeRates();
  const curr = (payload.currency || "USD") as Currency;
  const rate_at_entry = Number((rates[curr] || 1).toFixed(4));
  const amount_usd = Number((payload.amount / rate_at_entry).toFixed(4));

  const { error } = await supabase.from("budgets").insert({
    user_id: userId,
    ...payload,
    amount: Number(payload.amount.toFixed(4)),
    currency: curr,
    amount_usd,
    rate_at_entry,
  });
  if (error) throw new Error(`Failed to add budget: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (userId && session?.access_token) {
    refreshMetrics(userId, session.access_token);
  }
}

export async function updateBudget(
  id: string,
  payload: Partial<Omit<Budget, "id" | "user_id" | "created_at">>
): Promise<void> {
  const supabase = getClient();
  const updates: Record<string, unknown> = { ...payload };

  if (payload.amount !== undefined || payload.currency !== undefined) {
    const rates = await getExchangeRates();
    // Default to USD if currency is not provided in payload, though it should ideally be fetched from the existing budget if missing.
    // However, the UI always sends the full form state so currency will be provided during edits.
    const curr = (payload.currency || "USD") as Currency;
    const rate_at_entry = Number((rates[curr] || 1).toFixed(4));
    // Assuming UI always sends amount if it sends currency, but safety check:
    const amt = payload.amount !== undefined ? payload.amount : 0; 
    
    // Only update amount_usd if amount to update is provided. 
    // In practice, BudgetForm sends { name, type, categories, amount, date_from, date_to, recurrence, currency }
    if (payload.amount !== undefined) {
      updates.currency = curr;
      updates.rate_at_entry = rate_at_entry;
      updates.amount_usd = Number((amt / rate_at_entry).toFixed(4));
    }
  }

  if (payload.amount !== undefined) {
    updates.amount = Number(payload.amount.toFixed(4));
  }

  const { error } = await supabase
    .from("budgets")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(`Failed to update budget: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete budget: ${error.message}`);

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && session?.access_token) {
    refreshMetrics(session.user.id, session.access_token);
  }
}
