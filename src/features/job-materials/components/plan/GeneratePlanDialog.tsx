"use client";

import { useEffect, useState } from "react";

import { ModalDialog } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import { useMaterialPlan } from "../../state/MaterialPlanProvider";
import { PlanError } from "./PlanFormParts";
import { planFieldClass } from "./planStyles";

interface KitOption {
  id: string;
  name: string;
  category: string | null;
  lineCount: number;
}

interface GeneratePlanDialogProps {
  /** "generate" offers the estimate; "kit" only adds kits. */
  mode: "generate" | "kit";
  onClose: () => void;
}

/** Build or extend a job's plan from its estimate and/or kits. Nothing is reserved. */
export function GeneratePlanDialog({ mode, onClose }: GeneratePlanDialogProps) {
  const { role } = useCurrentRole();
  const { kits: attached, generate, busy } = useMaterialPlan();
  const [includeEstimate, setIncludeEstimate] = useState(mode === "generate");
  const [options, setOptions] = useState<KitOption[] | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    void requestJson<{ kits: KitOption[] }>("/api/inventory/kits", { role, cache: "no-store" })
      .then((data) => {
        if (!cancelled) setOptions(data.kits ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setError("Could not load kits.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const attachedIds = new Set(attached.map((kit) => kit.kitId));
  const available = (options ?? []).filter((kit) => !attachedIds.has(kit.id));
  const chosen = Object.keys(picked);
  const nothingChosen = !includeEstimate && chosen.length === 0;

  async function submit() {
    setError(null);
    const kits = chosen.map((kitId) => {
      const multiplier = Number(picked[kitId]);
      return { kitId, multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1 };
    });
    const result = await generate({ includeEstimate, kits });
    if (!result.ok) return setError(result.message ?? "Could not build the plan.");
    const summary = result.summary;
    if (!summary) return onClose();
    const parts = [`${summary.added} line${summary.added === 1 ? "" : "s"} added`];
    if (summary.skipped > 0) parts.push(`${summary.skipped} already there`);
    if (summary.needsSku > 0) parts.push(`${summary.needsSku} need a catalog item`);
    if (summary.nonProductSkipped > 0) parts.push(`${summary.nonProductSkipped} service/charge line${summary.nonProductSkipped === 1 ? "" : "s"} skipped`);
    setDone(`${parts.join(" · ")}.`);
  }

  return (
    <ModalDialog
      title={mode === "generate" ? "Build the material plan" : "Add a kit"}
      description="This is a draft. Nothing is reserved or pulled until the plan is confirmed."
      onClose={onClose}
    >
      {done ? (
        <div className="space-y-4">
          <p role="status" className="status-success rounded-atlas-md px-3 py-2 text-sm">
            {done}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <PlanError message={error} />

          {mode === "generate" ? (
            <label className="flex items-start gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={includeEstimate}
                onChange={(event) => setIncludeEstimate(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                Material lines from the estimate
                <span className="block text-xs text-muted">Product lines only. Services and charges are skipped.</span>
              </span>
            </label>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">Kits</legend>
            {options === null ? (
              <p className="text-sm text-muted">Loading kits…</p>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted">
                {options.length === 0 ? "No kits have been built yet." : "Every active kit is already on this job."}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-atlas-md border border-default">
                {available.map((kit) => {
                  const on = kit.id in picked;
                  return (
                    <li key={kit.id} className="flex min-h-11 items-center gap-3 bg-surface px-3 py-2">
                      <input
                        id={`kit-${kit.id}`}
                        type="checkbox"
                        checked={on}
                        onChange={(event) =>
                          setPicked((current) => {
                            const next = { ...current };
                            if (event.target.checked) next[kit.id] = "1";
                            else delete next[kit.id];
                            return next;
                          })
                        }
                        className="h-4 w-4"
                      />
                      <label htmlFor={`kit-${kit.id}`} className="min-w-0 flex-1 text-sm text-primary">
                        <span className="font-medium">{kit.name}</span>
                        <span className="ml-2 text-xs text-muted">
                          {[kit.category, `${kit.lineCount} item${kit.lineCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                        </span>
                      </label>
                      {on ? (
                        <label className="flex items-center gap-1.5 text-xs text-muted">
                          ×
                          <input
                            aria-label={`${kit.name} multiplier`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            value={picked[kit.id]}
                            onChange={(event) => setPicked((current) => ({ ...current, [kit.id]: event.target.value }))}
                            className={`${planFieldClass} w-20 py-1`}
                          />
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={busy || nothingChosen}>
              {busy ? "Building…" : mode === "generate" ? "Build plan" : "Add kit"}
            </Button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
