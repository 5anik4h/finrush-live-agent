const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Trigger a backend metrics refresh for the user.
 * Should be called after any data mutation (transactions, investments, savings).
 */
export async function refreshMetrics(userId: string, token: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/metrics/refresh?user_id=${userId}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) {
      console.warn("Failed to refresh metrics on backend", await res.text());
    }
  } catch (err) {
    console.error("Error calling /api/metrics/refresh:", err);
  }
}
