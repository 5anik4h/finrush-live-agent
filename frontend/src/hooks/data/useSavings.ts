import { useState, useEffect, useCallback } from "react";
import { getSavingsPots } from "@/services/savings";
import type { SavingsPot } from "@/types";

export function useSavings(
  userId: string | null,
  refreshTrigger: number = 0
) {
  const [pots, setPots] = useState<SavingsPot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setPots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSavingsPots(userId);
      setPots(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshTrigger]);

  return { pots, loading, error, reload };
}
