"use client";

import { History, Layers, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { useJobMaterials } from "../../state/JobMaterialsProvider";
import { useMaterialPlan } from "../../state/MaterialPlanProvider";
import { GeneratePlanDialog } from "./GeneratePlanDialog";
import { PlanHistoryDialog } from "./PlanHistoryDialog";
import { SaveAsKitDialog } from "./SaveAsKitDialog";

type Open = "generate" | "kit" | "history" | "save" | null;

/**
 * The plan strip above the materials list: status, kits, and the plan-level actions.
 * Techs see the status only; everything else needs an office role.
 */
export function MaterialPlanBar() {
  const { lines } = useJobMaterials();
  const { plan, kits, needsSkuCount, loading, busy, canEdit, canConfirm, canResolve, refreshKit, setStatus } = useMaterialPlan();
  const [open, setOpen] = useState<Open>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (loading) return null;
  if (!plan && !canEdit) return null;

  async function toggleStatus() {
    if (!plan) return;
    const result = await setStatus(plan.status === "confirmed" ? "draft" : "confirmed");
    if (!result.ok) return setMessage({ tone: "error", text: result.message ?? "Could not change the plan." });
    setMessage(
      plan.status === "draft" && needsSkuCount > 0
        ? { tone: "ok", text: `Confirmed. ${needsSkuCount} line${needsSkuCount === 1 ? " still needs" : "s still need"} a catalog item before they can be reserved.` }
        : null,
    );
  }

  async function refresh(kitId: string, name: string) {
    const result = await refreshKit(kitId);
    if (!result.ok) return setMessage({ tone: "error", text: result.message ?? "Could not refresh from the kit." });
    const counts = result.kitCounts;
    setMessage({
      tone: "ok",
      text: counts
        ? `${name}: ${counts.added} added, ${counts.updated} updated, ${counts.skipped} left as adjusted.`
        : `${name} refreshed.`,
    });
  }

  const planLines = lines.filter((line) => line.planId !== null);

  return (
    <div className="mt-4 space-y-3 rounded-atlas-md border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        {plan ? (
          <>
            <StatusBadge variant={plan.status === "confirmed" ? "success" : "warning"}>
              {plan.status === "confirmed" ? "Plan confirmed" : "Draft plan"}
            </StatusBadge>
            {needsSkuCount > 0 ? (
              <StatusBadge variant="info">
                {needsSkuCount} need{needsSkuCount === 1 ? "s" : ""} a catalog item
              </StatusBadge>
            ) : null}
            <span className="text-xs text-muted">
              {plan.status === "confirmed" ? "Reservations are not live yet." : "Nothing is reserved yet."}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">No plan yet. Build one from the estimate or a kit.</span>
        )}

        {canEdit ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen("generate")} disabled={busy}>
              <Sparkles size={14} aria-hidden="true" />
              {plan ? "Add from estimate" : "Build plan"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen("kit")} disabled={busy}>
              <Layers size={14} aria-hidden="true" />
              Add kit
            </Button>
            {plan && canConfirm ? (
              <Button type="button" size="sm" variant={plan.status === "confirmed" ? "outline" : "primary"} onClick={() => void toggleStatus()} disabled={busy || planLines.length === 0}>
                {plan.status === "confirmed" ? "Reopen" : "Confirm plan"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {kits.length > 0 ? (
        <ul aria-label="Kits on this job" className="flex flex-wrap gap-2">
          {kits.map((kit) => {
            const stale = kit.currentKitVersion > kit.kitVersion;
            return (
              <li key={kit.id} className="inline-flex items-center gap-2 rounded-full border border-default bg-surface-elevated py-1 pl-3 pr-1.5 text-xs text-primary">
                <span>
                  {kit.kitName}
                  {kit.multiplier !== 1 ? ` ×${kit.multiplier}` : ""}
                </span>
                {stale ? <StatusBadge variant="info">Kit updated</StatusBadge> : null}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void refresh(kit.kitId, kit.kitName)}
                    disabled={busy}
                    aria-label={`Refresh from ${kit.kitName}`}
                    className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-muted transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50"
                  >
                    <RefreshCw size={12} aria-hidden="true" />
                    Refresh
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`${message.tone === "error" ? "status-danger" : "status-success"} rounded-atlas-md px-3 py-2 text-xs`}>
          {message.text}
        </p>
      ) : null}

      {plan ? (
        <div className="flex flex-wrap gap-3 text-xs">
          <button type="button" onClick={() => setOpen("history")} className="inline-flex items-center gap-1 text-muted underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
            <History size={12} aria-hidden="true" />
            History
          </button>
          {canResolve ? (
            <button type="button" onClick={() => setOpen("save")} className="text-muted underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
              Save these materials as a kit
            </button>
          ) : null}
        </div>
      ) : null}

      {open === "generate" || open === "kit" ? <GeneratePlanDialog mode={open} onClose={() => setOpen(null)} /> : null}
      {open === "history" ? <PlanHistoryDialog onClose={() => setOpen(null)} /> : null}
      {open === "save" ? <SaveAsKitDialog onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
