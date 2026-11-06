"use client";

import { useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { companyTimeZone } from "@/lib/timezone";

import { useJobMaterials } from "../state/JobMaterialsProvider";
import { MaterialPlanProvider } from "../state/MaterialPlanProvider";
import {
  JOB_MATERIAL_STATES,
  JOB_MATERIAL_STATE_LABELS,
  type JobMaterialLine,
  type JobMaterialState,
} from "../types/jobMaterials";
import { formatMaterialQuantity } from "../utils/jobMaterials";
import { MaterialPlanBar } from "./plan/MaterialPlanBar";
import { PlanLineBadges, PlanLineControls, planLineDetail } from "./plan/PlanLineParts";

const STATE_STYLES: Record<JobMaterialState, { on: string; dot: string }> = {
  needed: { on: "border-red-500/40 bg-red-500/15 text-red-200", dot: "bg-red-400" },
  on_truck: { on: "border-blue-500/40 bg-blue-500/15 text-blue-200", dot: "bg-blue-400" },
  used: { on: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200", dot: "bg-emerald-400" },
};

function stateStamp(line: JobMaterialLine): string | null {
  if (!line.stateChangedAt) return null;
  const at = new Date(line.stateChangedAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString("en-US", {
    timeZone: companyTimeZone(),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StateControl({
  line,
  disabled,
  onChange,
}: {
  line: JobMaterialLine;
  disabled: boolean;
  onChange: (state: JobMaterialState) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`${line.name} status`}
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-white/10"
    >
      {JOB_MATERIAL_STATES.map((state) => {
        const active = line.state === state;
        return (
          <button
            key={state}
            type="button"
            aria-pressed={active}
            disabled={disabled || active}
            onClick={() => onChange(state)}
            className={`min-h-9 px-2.5 text-xs font-medium transition-colors sm:min-h-7 ${
              active
                ? STATE_STYLES[state].on
                : "bg-white/[0.02] text-slate-400 hover:bg-white/10 hover:text-slate-200"
            } ${state !== "needed" ? "border-l border-white/10" : ""}`}
          >
            {JOB_MATERIAL_STATE_LABELS[state]}
          </button>
        );
      })}
    </div>
  );
}

function QuantityInput({
  line,
  disabled,
  onCommit,
}: {
  line: JobMaterialLine;
  disabled: boolean;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(line.quantity);
  return (
    <label className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
      <span className="sr-only">Quantity for {line.name}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft);
          setDraft(null);
          if (draft !== null && Number.isFinite(next) && next > 0 && next !== line.quantity) {
            onCommit(next);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="w-16 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-sm text-slate-100 outline-none focus:border-blue-500/40"
      />
      <span>{line.unit}</span>
    </label>
  );
}

function AddMaterialForm() {
  const { addLine } = useJobMaterials();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("ea");
  const [partNumber, setPartNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const ok = await addLine({
      name: name.trim(),
      quantity: Number(quantity) || 1,
      unit: unit.trim() || "ea",
      partNumber: partNumber.trim() || null,
      notes: notes.trim(),
    });
    setSaving(false);
    if (ok) {
      setName("");
      setQuantity("1");
      setPartNumber("");
      setNotes("");
    }
  };

  const field =
    "min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/40";

  return (
    <form
      className="mt-4 grid gap-2 border-t border-white/5 pt-4 sm:grid-cols-[1fr_5rem_4.5rem_8rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <input
        aria-label="Material name"
        placeholder="Add a material (e.g. condensate pump)"
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
        className={field}
      />
      <input
        aria-label="Quantity"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        className={field}
      />
      <input
        aria-label="Unit"
        placeholder="ea"
        value={unit}
        maxLength={20}
        onChange={(event) => setUnit(event.target.value)}
        className={field}
      />
      <input
        aria-label="Part number (optional)"
        placeholder="Part # (optional)"
        value={partNumber}
        maxLength={100}
        onChange={(event) => setPartNumber(event.target.value)}
        className={field}
      />
      <Button type="submit" variant="secondary" disabled={saving || !name.trim()} className="gap-1.5">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add
      </Button>
      <input
        aria-label="Notes (optional)"
        placeholder="Notes (optional)"
        value={notes}
        maxLength={2000}
        onChange={(event) => setNotes(event.target.value)}
        className={`${field} sm:col-span-5`}
      />
    </form>
  );
}

function MaterialsBody({ compact }: { compact: boolean }) {
  const {
    lines,
    summary,
    loading,
    error,
    pendingIds,
    canManage,
    canProgress,
    setLineState,
    setLineQuantity,
    removeLine,
  } = useJobMaterials();

  const body = (
    <>
      <div className="flex items-start gap-3">
        {!compact ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/30">
            <Package className="h-5 w-5 text-blue-300" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className={compact ? "text-sm font-semibold text-white" : "text-lg font-semibold text-white"}>
            Materials
          </h2>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-400">
              What this job needs, what is on the truck, and what got used.
            </p>
          ) : null}
        </div>
        {summary.total > 0 ? (
          <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5 text-xs" aria-label="Materials summary">
            {JOB_MATERIAL_STATES.map((state) => {
              const count =
                state === "needed" ? summary.needed : state === "on_truck" ? summary.onTruck : summary.used;
              return (
                <span
                  key={state}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-slate-300"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${STATE_STYLES[state].dot}`} />
                  {count} {JOB_MATERIAL_STATE_LABELS[state].toLowerCase()}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      {!compact ? <MaterialPlanBar /> : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading materials…
        </div>
      ) : lines.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          {canManage
            ? "No materials yet. Add what the crew needs to bring."
            : "The office has not added a materials list for this job yet."}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {lines.map((line) => {
            const pending = pendingIds.has(line.id);
            const stamp = stateStamp(line);
            // Office edits to a plan line go through the plan API so the change is explained and recorded.
            const planManaged = !compact && canManage && line.planId !== null;
            const detail = planLineDetail(line);
            return (
              <li
                key={line.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm ${line.state === "used" ? "text-slate-400" : "text-slate-100"}`}
                    title={line.name}
                  >
                    {line.name}
                    {!compact ? <PlanLineBadges line={line} /> : null}
                    {!canProgress ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {formatMaterialQuantity(line.quantity, line.unit)}
                      </span>
                    ) : null}
                  </p>
                  {line.partNumber || line.notes || stamp || (!compact && detail) ? (
                    <p className="truncate text-xs text-slate-500">
                      {[
                        !compact ? detail : null,
                        line.partNumber ? `Part ${line.partNumber}` : null,
                        line.notes || null,
                        stamp ? `${JOB_MATERIAL_STATE_LABELS[line.state]} ${stamp}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {canProgress && !planManaged ? (
                    <QuantityInput
                      line={line}
                      disabled={pending}
                      onCommit={(quantity) => void setLineQuantity(line.id, quantity)}
                    />
                  ) : null}
                  {planManaged ? (
                    <span className="shrink-0 text-xs text-slate-300">
                      {formatMaterialQuantity(line.quantity, line.unit)}
                    </span>
                  ) : null}
                  {canProgress ? (
                    <StateControl
                      line={line}
                      disabled={pending}
                      onChange={(state) => void setLineState(line.id, state)}
                    />
                  ) : (
                    <span className="text-xs text-slate-400">{JOB_MATERIAL_STATE_LABELS[line.state]}</span>
                  )}
                  {planManaged ? <PlanLineControls line={line} disabled={pending} /> : null}
                  {canManage && !planManaged ? (
                    <button
                      type="button"
                      onClick={() => void removeLine(line.id)}
                      disabled={pending}
                      aria-label={`Remove ${line.name}`}
                      className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? <AddMaterialForm /> : null}
    </>
  );

  return body;
}

/**
 * Per-job materials checklist (#23) and, below the header, the Lane 4 material plan.
 * Office builds the plan (estimate lines and kits), confirms it and explains changes;
 * anyone on the job moves lines Needed → On truck → Used and fixes the quantity.
 * The compact variant (Dispatch board) stays the plain checklist.
 */
export function JobMaterialsPanel({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="space-y-0">
        <MaterialsBody compact />
      </div>
    );
  }
  return (
    <SurfaceCard>
      <div className="p-6">
        <MaterialPlanProvider>
          <MaterialsBody compact={false} />
        </MaterialPlanProvider>
      </div>
    </SurfaceCard>
  );
}
