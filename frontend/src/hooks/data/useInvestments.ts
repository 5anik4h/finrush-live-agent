import { useState, useEffect, useCallback } from "react";
import { getInvestmentsSummary, getNormalizedInvestmentValue } from "@/services/investments";
import type { InvestmentSummary } from "@/types";

export function useInvestments(
  userId: string | null,
  refreshTrigger: number = 0
) {
  const [investments, setInvestments] = useState<InvestmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setInvestments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getInvestmentsSummary(userId);
      setInvestments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshTrigger]);

  return { investments, loading, error, reload };
}

export function useNormalizedInvestmentValue(
  userId: string | null,
  refreshTrigger: number = 0
) {
  const [value, setValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setValue(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const investmentValue = await getNormalizedInvestmentValue(userId);
      setValue(investmentValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setValue(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshTrigger]);

  return { value, loading, error, reload };
}
