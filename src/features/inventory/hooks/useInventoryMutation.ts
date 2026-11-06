"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

interface ApiErrorBody {
  message?: string;
  error?: string;
}

/**
 * Sends JSON to an inventory API route, surfaces the server's validation
 * message as-is, and refreshes the server-rendered screen on success.
 */
export function useInventoryMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (url: string, method: Method, body?: unknown): Promise<{ ok: boolean; data?: unknown }> => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const data = (await response.json().catch(() => ({}))) as ApiErrorBody;
        if (!response.ok) {
          setError(data.message || data.error || "Something went wrong. Please try again.");
          return { ok: false };
        }
        router.refresh();
        return { ok: true, data };
      } catch {
        setError("Network error. Check your connection and try again.");
        return { ok: false };
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const clearError = useCallback(() => setError(null), []);
  return { run, pending, error, setError, clearError };
}
