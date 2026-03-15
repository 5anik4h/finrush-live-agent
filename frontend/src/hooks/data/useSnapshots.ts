import { useState, useEffect, useCallback } from "react";
import { getSnapshots, generateSnapshot } from "@/services/snapshots";
import type { MonthlySnapshot } from "@/types";

export function useSnapshots(
  userId: string | null,
  accessToken: string | null,
  refreshTrigger: number = 0
) {
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSnapshots(userId);
      setSnapshots(data);
    } catch (e) {
      // Snapshots optional — chart falls back to tx-based calculation
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload, refreshTrigger]);

  // Auto-generate snapshot for the previous month if missing (fires after initial load)
  useEffect(() => {
    if (!userId || !accessToken || loading) return;
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-indexed
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const exists = snapshots.some((s) => s.year === prevYear && s.month === prevMonth);
    if (exists) return;

    generateSnapshot(prevYear, prevMonth, accessToken)
      .then(() => reload())
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, accessToken, loading]);

  return { snapshots, loading, error, reload };
}
