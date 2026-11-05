"use client";

import { useCallback, useEffect, useState } from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { InstalledSystemManualsView } from "../types/manuals";

export type ManualDecision = "confirm" | "unlink" | "clear";

/** Loads /api/installed-systems/[id]/manuals and applies office decisions. */
export function useInstalledSystemManuals(systemId: string) {
  const { role } = useCurrentRole();
  const [view, setView] = useState<InstalledSystemManualsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchView = useCallback(async () => {
    if (!role) return null;
    try {
      const response = await requestJson<{ manuals: InstalledSystemManualsView }>(
        `/api/installed-systems/${encodeURIComponent(systemId)}/manuals`,
        { role, cache: "no-store" },
      );
      return { view: response.manuals ?? null, error: null as string | null };
    } catch (loadError) {
      return {
        view: null,
        error: loadError instanceof Error && loadError.message ? loadError.message : "Could not load manuals.",
      };
    }
  }, [role, systemId]);

  const apply = useCallback((result: { view: InstalledSystemManualsView | null; error: string | null }) => {
    setView(result.view);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchView().then((result) => {
      if (!cancelled && result) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, fetchView]);

  const decide = useCallback(
    async (manualId: string, action: ManualDecision) => {
      if (!role) return false;
      setPendingId(manualId);
      try {
        await requestJson(`/api/installed-systems/${encodeURIComponent(systemId)}/manuals`, {
          role,
          method: "POST",
          body: { manualId, action },
        });
        const result = await fetchView();
        if (result) apply(result);
        return true;
      } catch (decideError) {
        setError(decideError instanceof Error && decideError.message ? decideError.message : "Could not save.");
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [apply, fetchView, role, systemId],
  );

  return { view, loading, error, pendingId, decide };
}
