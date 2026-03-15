import { createClient } from "@/lib/supabase";
import { getExchangeRates } from "./rates";
import type { Currency } from "@/lib/currency";
import type { SavingsPot, SavingsContribution } from "@/types";
import { refreshMetrics } from "./metrics";

function getClient() {
  return createClient();
}

export async function syncPotBalances(potId: string): Promise<void> {
  const supabase = getClient();
  
  // Fetch the pot's currency and rate info
  const { data: pot } = await supabase
    .from("savings_pots")
    .select("currency, rate_at_entry")
    .eq("id", potId)
    .single();

  if (!pot) return;

  const { data: contributions } = await supabase
    .from("savings_contributions")
    .select("amount, amount_usd, currency")
    .eq("pot_id", potId);

  if (!contributions) return;

  // Total in USD is the source of truth for normalized value
  const totalUsd = contributions.reduce((sum, row) => sum + (Number(row.amount_usd) || 0), 0);
  
  // Calculate current_balance in pot's currency
  // We use the pot's current rate_at_entry to convert back from totalUsd
  const rate = Number(pot.rate_at_entry) || 1;
  const currentBalance = totalUsd * rate;

  await supabase.from("savings_pots")
    .update({ 
      current_balance: Number(currentBalance.toFixed(4)),
      current_balance_usd: Number(totalUsd.toFixed(4)),
      updated_at: new Date().toISOString()
    })
    .eq("id", potId);
}

export async function getSavingsPots(userId: string): Promise<SavingsPot[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("savings_pots")
    .select("id, short_id, name, current_balance, current_balance_usd, target_amount, target_amount_usd, rate_at_entry, currency")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch savings pots: ${error.message}`);
  return (data ?? []) as SavingsPot[];
}

export async function addSavingsPot(
  userId: string,
  payload: {
    name: string;
    target_amount: number | null;
    currency?: string;
  }
): Promise<void> {
  const supabase = getClient();
  const rates = await getExchangeRates();
  const curr = (payload.currency || "USD") as Currency;
  const rate_at_entry = Number((rates[curr] || 1).toFixed(4));
  const target_amount_usd = payload.target_amount ? Number((payload.target_amount / rate_at_entry).toFixed(4)) : null;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { error } = await supabase.from("savings_pots").insert({
    user_id: userId,
    ...payload,
    target_amount: payload.target_amount ? Number(payload.target_amount.toFixed(4)) : null,
    currency: curr,
    target_amount_usd,
    rate_at_entry,
  });
  if (error) throw new Error(`Failed to add savings pot: ${error.message}`);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}

export async function updateSavingsPot(
  id: string,
  payload: Partial<Omit<SavingsPot, "id" | "current_balance">>
): Promise<void> {
  const supabase = getClient();
  const updates: Record<string, unknown> = { ...payload };

  if (payload.target_amount !== undefined || payload.currency !== undefined) {
    const rates = await getExchangeRates();
    const curr = (payload.currency || "USD") as Currency;
    const rate_at_entry = rates[curr] || 1;
    
    // If target_amount is being updated, or currency is being updated, recalculate USD equivalent and rate_at_entry
    if (payload.target_amount !== undefined) {
      updates.currency = curr;
      updates.rate_at_entry = Number(rate_at_entry.toFixed(4));
      updates.target_amount_usd = payload.target_amount ? Number((payload.target_amount / rate_at_entry).toFixed(4)) : null;
    } else if (payload.currency !== undefined) { // If only currency is updated, we need to fetch the current target_amount to recalculate target_amount_usd
      const { data: potData, error: potError } = await supabase
        .from("savings_pots")
        .select("target_amount")
        .eq("id", id)
        .single();

      if (potError) throw new Error(`Failed to fetch pot for currency update: ${potError.message}`);
      
      const currentTargetAmount = potData?.target_amount;
      updates.currency = curr;
      updates.rate_at_entry = Number(rate_at_entry.toFixed(4));
      updates.target_amount_usd = currentTargetAmount ? Number((currentTargetAmount / rate_at_entry).toFixed(4)) : null;
    }
  }

  // Ensure target_amount is rounded if it's being updated
  if (payload.target_amount !== undefined) {
    updates.target_amount = payload.target_amount ? Number(payload.target_amount.toFixed(4)) : null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;

  const { error } = await supabase
    .from("savings_pots")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(`Failed to update savings pot: ${error.message}`);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}

export async function deleteSavingsPot(id: string): Promise<void> {
  const supabase = getClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;

  // Delete contributions first, then delete the pot
  await supabase.from("savings_contributions").delete().eq("pot_id", id);
  const { error } = await supabase.from("savings_pots").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete savings pot: ${error.message}`);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}

export async function getContributions(
  userId: string,
  potId: string
): Promise<SavingsContribution[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("savings_contributions")
    .select("id, short_id, amount, currency, note, date, created_at")
    .eq("pot_id", potId)
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw new Error(`Failed to fetch contributions: ${error.message}`);
  return (data ?? []) as SavingsContribution[];
}

export async function addContribution(
  userId: string,
  payload: {
    pot_id: string;
    amount: number;
    note: string | null;
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

  const { error } = await supabase.from("savings_contributions").insert({
    user_id: userId,
    ...payload,
    amount: Number(payload.amount.toFixed(4)),
    currency: curr,
    amount_usd,
    rate_at_entry,
  });
  if (error) throw new Error(`Failed to add contribution: ${error.message}`);
  
  await syncPotBalances(payload.pot_id);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}

export async function addWithdrawal(
  userId: string,
  payload: {
    pot_id: string;
    amount: number;
    note: string | null;
    date: string;
    currency?: string;
  }
): Promise<void> {
  const supabase = getClient();
  const rates = await getExchangeRates();
  const curr = (payload.currency || "USD") as Currency;
  const rate_at_entry = Number((rates[curr] || 1).toFixed(4));
  const amount_usd = Number((-payload.amount / rate_at_entry).toFixed(4));

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const { error } = await supabase.from("savings_contributions").insert({
    user_id: userId,
    pot_id: payload.pot_id,
    amount: Number((-payload.amount).toFixed(4)),
    note: payload.note,
    date: payload.date,
    currency: curr,
    amount_usd,
    rate_at_entry,
  });
  if (error) throw new Error(`Failed to add withdrawal: ${error.message}`);

  await syncPotBalances(payload.pot_id);

  if (userId && token) {
    refreshMetrics(userId, token);
  }
}
