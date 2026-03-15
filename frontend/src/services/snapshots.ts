import { createClient } from "@/lib/supabase";
import type { MonthlySnapshot } from "@/types";

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws/agent")
    .replace("ws://", "http://")
    .replace("wss://", "https://")
    .replace("/ws/agent", "");
}

function getClient() {
  return createClient();
}

export async function getSnapshots(userId: string): Promise<MonthlySnapshot[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("monthly_snapshots")
    .select("year, month, balance, investment_value, savings_value, net_worth")
    .eq("user_id", userId)
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) throw new Error(`Failed to fetch snapshots: ${error.message}`);
  return (data ?? []) as MonthlySnapshot[];
}

export async function generateSnapshot(
  year: number,
  month: number,
  token: string
): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month, token }),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate snapshot: ${res.statusText}`);
  }
}
