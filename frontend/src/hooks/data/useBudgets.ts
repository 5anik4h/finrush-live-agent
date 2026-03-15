import { useState, useEffect, useCallback } from "react";
import { getBudgets } from "@/services/budgets";
import type { Budget } from "@/types";

export function useBudgets(
  userId: string | null,
  refreshTrigger: number = 0
) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setBudgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getBudgets(userId);
      setBudgets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshTrigger]);

  return { budgets, loading, error, reload };
}
