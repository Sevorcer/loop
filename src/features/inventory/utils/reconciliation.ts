import type { AppRole } from "@/services/authorization";

import type { CloseoutEnforcement } from "../types/kits";
import type { MaterialsGateState, ReconcileLineInput, ReconcileLineRow } from "../types/reconciliation";

export const VARIANCE_REASON_MAX = 500;
export const OVERRIDE_REASON_MAX = 1000;
const OVERRIDE_ROLES: ReadonlySet<string> = new Set(["owner", "manager", "office"]);

/** Round to the 3 decimals the database stores. */
export function roundQty(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded; // no negative zero
}

/** pulled - used - returned: what is left unexplained on the pallet. Negative = used more than pulled. */
export function residualQty(pulled: number, used: number, returned: number): number {
  return roundQty(pulled - used - returned);
}

/** Starting point for a line on the closeout screen: everything pulled was used (an optional line nobody pulled, nothing). */
export function defaultInput(row: ReconcileLineRow): ReconcileLineInput {
  return {
    lineId: row.lineId,
    used: row.pulled > 0 ? row.pulled : row.isOptional ? 0 : row.planned,
    returned: 0,
    recovered: null,
    reason: null,
  };
}

/** True when a line needs a reason: its numbers do not add up to what was pulled. */
export function needsReason(row: ReconcileLineRow, input: ReconcileLineInput): boolean {
  if (residualQty(row.pulled, input.used, input.returned) === 0) return false;
  // A line that was never pulled and was used anyway ("bought on the way") is explained already.
  return row.pulled > 0;
}

export type ReconcileValidation = { ok: true; value: ReconcileLineInput[] } | { ok: false; message: string };

/** Mirrors the database rules so the form can say what is wrong before it posts. */
export function validateReconcileInput(
  rows: ReconcileLineRow[],
  inputs: ReconcileLineInput[],
): ReconcileValidation {
  const byLine = new Map(inputs.map((input) => [input.lineId, input]));
  const out: ReconcileLineInput[] = [];

  for (const row of rows) {
    if (row.reconciled) continue;
    const input = byLine.get(row.lineId);
    if (!input) {
      if (row.isOptional) continue;
      return { ok: false, message: `Enter what was used and returned for ${row.name}.` };
    }
    for (const value of [input.used, input.returned, input.recovered ?? 0]) {
      if (!Number.isFinite(value) || value < 0) {
        return { ok: false, message: `Quantities for ${row.name} must be zero or more.` };
      }
    }
    if (input.reason && input.reason.length > VARIANCE_REASON_MAX) {
      return { ok: false, message: `The reason for ${row.name} is too long.` };
    }
    if (needsReason(row, input) && !input.reason?.trim()) {
      const left = residualQty(row.pulled, input.used, input.returned);
      const what = left > 0 ? `${left} ${row.unit} left unaccounted for` : `${Math.abs(left)} ${row.unit} more used than pulled`;
      return { ok: false, message: `Say why for ${row.name}: ${what}.` };
    }
    out.push({
      lineId: row.lineId,
      used: roundQty(input.used),
      returned: roundQty(input.returned),
      recovered: input.recovered === null ? null : roundQty(input.recovered),
      reason: input.reason?.trim() ? input.reason.trim() : null,
    });
  }
  if (out.length === 0) return { ok: false, message: "There are no material lines to reconcile." };
  return { ok: true, value: out };
}

/** Wire form for the reconcile function. */
export function toRpcLines(inputs: ReconcileLineInput[]): Array<Record<string, unknown>> {
  return inputs.map((input) => ({
    line_id: input.lineId,
    used: input.used,
    returned: input.returned,
    ...(input.recovered === null ? {} : { recovered: input.recovered }),
    ...(input.reason ? { reason: input.reason } : {}),
  }));
}

/**
 * The staged gate. `warn` never blocks. `soft` and `hard` block completion of a job that needs
 * reconciling until it is reconciled (or, for soft, an office role records an override).
 */
export function materialsBlocksCompletion(state: MaterialsGateState): boolean {
  if (!state.required || state.reconciled) return false;
  return state.enforcement === "soft" || state.enforcement === "hard";
}

/** Who may complete past the gate: only an office role, and only at the soft stage. */
export function canOverrideMaterials(enforcement: CloseoutEnforcement, role: AppRole | undefined | null): boolean {
  return enforcement === "soft" && role !== undefined && role !== null && OVERRIDE_ROLES.has(role);
}

export type OverrideValidation = { ok: true; reason: string } | { ok: false; message: string };

export function normalizeOverrideReason(value: unknown): OverrideValidation {
  if (typeof value !== "string" || !value.trim()) return { ok: false, message: "An override needs a reason." };
  const reason = value.trim();
  if (reason.length > OVERRIDE_REASON_MAX) {
    return { ok: false, message: `The reason must be ${OVERRIDE_REASON_MAX} characters or fewer.` };
  }
  return { ok: true, reason };
}

/** The phrase the completion refusal uses for this gate (the completion card maps it to a label). */
export const MATERIALS_BLOCKER_TEXT = "materials are not reconciled";
