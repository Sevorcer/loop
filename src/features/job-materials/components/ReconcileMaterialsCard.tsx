"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import type { ReconcileLineInput, ReconcileLineRow, ReconciliationView } from "@/features/inventory/types/reconciliation";
import {
  canOverrideMaterials,
  defaultInput,
  needsReason,
  residualQty,
  validateReconcileInput,
} from "@/features/inventory/utils/reconciliation";
import { requestJson } from "@/lib/api/client";

import { PlanError } from "./plan/PlanFormParts";
import { planFieldClass } from "./plan/planStyles";

interface Draft {
  used: string;
  returned: string;
  recovered: string;
  reason: string;
}

function toDraft(row: ReconcileLineRow): Draft {
  const start = defaultInput(row);
  return { used: String(start.used), returned: "0", recovered: "", reason: "" };
}

function parseNumber(value: string): number {
  return value.trim() === "" ? 0 : Number(value);
}

function toInput(row: ReconcileLineRow, draft: Draft): ReconcileLineInput {
  return {
    lineId: row.lineId,
    used: parseNumber(draft.used),
    returned: parseNumber(draft.returned),
    recovered: draft.recovered.trim() === "" ? null : Number(draft.recovered),
    reason: draft.reason.trim() === "" ? null : draft.reason,
  };
}

/**
 * Closeout materials: what was used, what goes back to the shop, and why anything differs from
 * what was pulled. Shown for jobs with a confirmed plan. The assigned tech or office submits;
 * at the office-override stage an office role can instead complete without reconciling.
 */
export function ReconcileMaterialsCard({ jobId }: { jobId: string }) {
  const { role } = useCurrentRole();
  const [view, setView] = useState<ReconciliationView | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await requestJson<ReconciliationView>(`/api/jobs/${encodeURIComponent(jobId)}/reconciliation`);
      setView(next);
      setDrafts((current) => {
        const out: Record<string, Draft> = {};
        for (const row of next.lines) out[row.lineId] = current[row.lineId] ?? toDraft(row);
        return out;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load materials.");
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!view || !view.required) return null;

  const open = view.status === "none";
  const rows = view.lines.filter((row) => !row.reconciled);
  const canOverride = open && canOverrideMaterials(view.enforcement, role);

  function setField(lineId: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [lineId]: { ...current[lineId], [field]: value } }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const inputs = rows.map((row) => toInput(row, drafts[row.lineId] ?? toDraft(row)));
    const checked = validateReconcileInput(rows, inputs);
    if (!checked.ok) return setError(checked.message);
    setSaving(true);
    try {
      await requestJson(`/api/jobs/${encodeURIComponent(jobId)}/reconciliation`, {
        method: "POST",
        body: { lines: checked.value },
      });
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save materials.");
    } finally {
      setSaving(false);
    }
  }

  async function override(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await requestJson(`/api/jobs/${encodeURIComponent(jobId)}/reconciliation/override`, {
        method: "POST",
        body: { reason: overrideReason },
      });
      setOverrideOpen(false);
      await load();
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "Could not record the override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="job-closeout-materials" className="scroll-mt-24 md:scroll-mt-48">
      <SectionCard
        title="Closeout materials"
        description={
          open
            ? view.enforcement === "warn"
              ? "Record what was used and what goes back to the shop. Not required yet, but it keeps stock counts right."
              : "Record what was used and what goes back to the shop. The job cannot be completed until this is done."
            : undefined
        }
        actions={
          view.status === "submitted" ? (
            <StatusBadge variant="success">Reconciled</StatusBadge>
          ) : view.status === "overridden" ? (
            <StatusBadge variant="warning">Overridden</StatusBadge>
          ) : null
        }
      >
        <PlanError message={error} />

        {view.status === "overridden" ? (
          <p className="text-sm text-muted">Completed without reconciling. Reason: {view.overrideReason}</p>
        ) : null}

        {view.status === "submitted" ? (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {view.lines.map((row) => (
              <li key={row.lineId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="font-medium text-primary">{row.name}</span>
                <span className="text-muted">
                  Used {row.usedQty ?? 0} · Returned {row.returnedQty ?? 0} {row.unit}
                  {row.varianceReason ? ` · ${row.varianceReason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {open ? (
          <form onSubmit={submit} noValidate className="space-y-4">
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((row) => {
                const draft = drafts[row.lineId] ?? toDraft(row);
                const input = toInput(row, draft);
                const left = residualQty(row.pulled, input.used, input.returned);
                const askWhy = needsReason(row, input);
                const isRefrigerant = row.itemKind === "refrigerant";
                return (
                  <li key={row.lineId} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-primary">
                        {row.name}
                        {row.isOptional ? <span className="ml-2 text-xs text-muted">optional</span> : null}
                      </span>
                      <span className="text-xs text-muted">
                        Planned {row.planned} · On the pallet {row.pulled} {row.unit}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="text-xs text-muted">
                        Used
                        <input
                          inputMode="decimal"
                          value={draft.used}
                          onChange={(e) => setField(row.lineId, "used", e.target.value)}
                          className={planFieldClass}
                        />
                      </label>
                      <label className="text-xs text-muted">
                        Back to shop
                        <input
                          inputMode="decimal"
                          value={draft.returned}
                          onChange={(e) => setField(row.lineId, "returned", e.target.value)}
                          className={planFieldClass}
                        />
                      </label>
                      {isRefrigerant ? (
                        <label className="text-xs text-muted">
                          Recovered (lb)
                          <input
                            inputMode="decimal"
                            value={draft.recovered}
                            onChange={(e) => setField(row.lineId, "recovered", e.target.value)}
                            className={planFieldClass}
                          />
                        </label>
                      ) : null}
                    </div>
                    {askWhy ? (
                      <label className="block text-xs text-muted">
                        {left > 0 ? `${left} ${row.unit} left over: why?` : `${Math.abs(left)} ${row.unit} more used than pulled: why?`}
                        <input
                          value={draft.reason}
                          onChange={(e) => setField(row.lineId, "reason", e.target.value)}
                          maxLength={500}
                          placeholder="Over-pulled, damaged, left on site…"
                          className={planFieldClass}
                        />
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canOverride ? (
                <Button type="button" variant="ghost" onClick={() => setOverrideOpen((value) => !value)}>
                  Complete without reconciling
                </Button>
              ) : null}
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Submit materials"}
              </Button>
            </div>
          </form>
        ) : null}

        {open && canOverride && overrideOpen ? (
          <form onSubmit={override} noValidate className="mt-4 space-y-2 rounded-atlas-md bg-surface-elevated p-3">
            <label className="block text-sm font-medium text-primary" htmlFor="override-reason">
              Why is this job being completed without reconciling materials?
            </label>
            <textarea
              id="override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              maxLength={1000}
              className={planFieldClass}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" disabled={saving || overrideReason.trim() === ""}>
                Record override
              </Button>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}
