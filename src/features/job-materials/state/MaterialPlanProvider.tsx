"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type {
  JobKitAttachment,
  JobMaterialPlanView,
  MaterialLineEvent,
  MaterialPlan,
  PlanGenerationSummary,
} from "../types/materialPlan";
import { canConfirmMaterialPlan, canEditMaterialPlan, canResolveNeedsSku } from "../utils/materialPlan";
import { useJobMaterials } from "./JobMaterialsProvider";

export interface ActionResult {
  ok: boolean;
  /** Server message when the action failed; the dialogs show it inline. */
  message?: string;
  summary?: PlanGenerationSummary;
  kitCounts?: { added: number; updated: number; skipped: number };
}

interface MaterialPlanContextValue {
  plan: MaterialPlan | null;
  kits: JobKitAttachment[];
  needsSkuCount: number;
  loading: boolean;
  busy: boolean;
  canEdit: boolean;
  canConfirm: boolean;
  canResolve: boolean;
  generate: (input: { includeEstimate: boolean; kits: Array<{ kitId: string; multiplier: number }> }) => Promise<ActionResult>;
  attachKit: (kitId: string, multiplier: number) => Promise<ActionResult>;
  refreshKit: (kitId: string) => Promise<ActionResult>;
  setStatus: (status: "confirmed" | "draft") => Promise<ActionResult>;
  adjustLine: (lineId: string, body: Record<string, unknown>) => Promise<ActionResult>;
  linkLine: (lineId: string, catalogItemId: string, writeAlias: boolean) => Promise<ActionResult>;
  markNotStock: (lineId: string, reason: string) => Promise<ActionResult>;
  removeLine: (lineId: string, reason: string) => Promise<ActionResult>;
  saveAsKit: (name: string) => Promise<ActionResult & { kitId?: string; skippedUnlinked?: number }>;
  loadHistory: () => Promise<MaterialLineEvent[] | null>;
}

const MaterialPlanContext = createContext<MaterialPlanContextValue | null>(null);

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Plan header, attached kits and the plan actions for one job. Lives inside
 * JobMaterialsProvider: every plan action returns the whole plan view, so the
 * materials list is replaced from the same response instead of being re-fetched.
 */
export function MaterialPlanProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const { jobId, replaceLines, canProgress } = useJobMaterials();
  const base = `/api/jobs/${encodeURIComponent(jobId)}/material-plan`;

  const [plan, setPlan] = useState<MaterialPlan | null>(null);
  const [kits, setKits] = useState<JobKitAttachment[]>([]);
  const [needsSkuCount, setNeedsSkuCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const applyView = useCallback(
    (view: JobMaterialPlanView) => {
      setPlan(view.plan);
      setKits(view.kits ?? []);
      setNeedsSkuCount(view.needsSkuCount ?? 0);
      if (view.lines) replaceLines(view.lines);
    },
    [replaceLines],
  );

  // Initial load. The header is best-effort: the materials list works without it.
  useEffect(() => {
    if (!role || !canProgress) return;
    let cancelled = false;
    void requestJson<JobMaterialPlanView>(base, { role, cache: "no-store" })
      .then((view) => {
        if (cancelled) return;
        setPlan(view.plan);
        setKits(view.kits ?? []);
        setNeedsSkuCount(view.needsSkuCount ?? 0);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base, canProgress, role]);

  const act = useCallback(
    async (
      url: string,
      method: "POST" | "PATCH",
      body?: unknown,
      fallback = "That did not work. Please try again.",
    ): Promise<ActionResult & { raw?: Record<string, unknown> }> => {
      if (!role) return { ok: false, message: "Sign in again to continue." };
      setBusy(true);
      try {
        const data = await requestJson<JobMaterialPlanView & Record<string, unknown>>(url, {
          role,
          method,
          body,
        });
        if (data && "lines" in data) applyView(data);
        return {
          ok: true,
          raw: data,
          summary: data?.summary as PlanGenerationSummary | undefined,
          kitCounts: data?.result as ActionResult["kitCounts"],
        };
      } catch (error) {
        return { ok: false, message: messageOf(error, fallback) };
      } finally {
        setBusy(false);
      }
    },
    [applyView, role],
  );

  const lineUrl = useCallback((lineId: string) => `${base}/lines/${encodeURIComponent(lineId)}`, [base]);

  const value = useMemo<MaterialPlanContextValue>(
    () => ({
      plan,
      kits,
      needsSkuCount,
      loading,
      busy,
      canEdit: canEditMaterialPlan(role),
      canConfirm: canConfirmMaterialPlan(role),
      canResolve: canResolveNeedsSku(role),
      generate: (input) => act(base, "POST", input, "Could not build the plan."),
      attachKit: (kitId, multiplier) => act(`${base}/kits`, "POST", { kitId, multiplier }, "Could not attach the kit."),
      refreshKit: (kitId) => act(`${base}/kits/${encodeURIComponent(kitId)}`, "POST", undefined, "Could not refresh from the kit."),
      setStatus: (status) => act(base, "PATCH", { status }, "Could not change the plan status."),
      adjustLine: (lineId, body) => act(lineUrl(lineId), "PATCH", { action: "adjust", ...body }, "Could not change the line."),
      linkLine: (lineId, catalogItemId, writeAlias) =>
        act(lineUrl(lineId), "PATCH", { action: "link", catalogItemId, writeAlias }, "Could not link the item."),
      markNotStock: (lineId, reason) => act(lineUrl(lineId), "PATCH", { action: "not_stock", reason }, "Could not save that."),
      removeLine: (lineId, reason) => act(lineUrl(lineId), "PATCH", { action: "remove", reason }, "Could not remove the line."),
      saveAsKit: async (name) => {
        if (!role) return { ok: false, message: "Sign in again to continue." };
        setBusy(true);
        try {
          const data = await requestJson<{ kit?: { id?: string }; skippedUnlinked?: number }>(`${base}/save-as-kit`, {
            role,
            method: "POST",
            body: { name },
          });
          return { ok: true, kitId: data.kit?.id, skippedUnlinked: data.skippedUnlinked };
        } catch (error) {
          return { ok: false, message: messageOf(error, "Could not save the kit.") };
        } finally {
          setBusy(false);
        }
      },
      loadHistory: async () => {
        if (!role) return null;
        try {
          const data = await requestJson<{ events: MaterialLineEvent[] }>(`${base}/history`, { role, cache: "no-store" });
          return data.events ?? [];
        } catch {
          return null;
        }
      },
    }),
    [plan, kits, needsSkuCount, loading, busy, role, act, base, lineUrl],
  );

  return <MaterialPlanContext.Provider value={value}>{children}</MaterialPlanContext.Provider>;
}

export function useMaterialPlan(): MaterialPlanContextValue {
  const context = useContext(MaterialPlanContext);
  if (!context) throw new Error("useMaterialPlan must be used inside MaterialPlanProvider");
  return context;
}
