import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "@/services/transactions";
import type { Transaction } from "@/types";

export function useTransactions(
  userId: string | null,
  refreshTrigger: number = 0
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactions(userId);
      setTransactions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshTrigger]);

  return { transactions, loading, error, reload };
}
