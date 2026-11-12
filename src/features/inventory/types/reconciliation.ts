// Closeout reconciliation (Inventory Lane 4, PR E). At closeout the real numbers are
// recorded per material line: how much was used, how much went back to the shop, and why
// any difference exists. Quantities only, never money.

import type { CloseoutEnforcement } from "./kits";

export type ReconciliationStatus = "none" | "submitted" | "overridden";

/** One catalog-linked material line, as the closeout screen needs it. */
export interface ReconcileLineRow {
  lineId: string;
  name: string;
  unit: string;
  itemId: string;
  itemKind: string | null;
  planned: number;
  /** On the job's pallet (pulled reservations). 0 when the line was never pulled. */
  pulled: number;
  isOptional: boolean;
  reconciled: boolean;
  usedQty: number | null;
  returnedQty: number | null;
  recoveredQty: number | null;
  varianceReason: string | null;
}

/** A refrigerant cylinder on hand (a unit of a serialized refrigerant item) a line can name. */
export interface ReconcileCylinder {
  id: string;
  serialNumber: string;
  itemName: string;
}

export interface ReconciliationView {
  /** A full-closeout job with at least one catalog-linked, non-optional line. */
  required: boolean;
  status: ReconciliationStatus;
  enforcement: CloseoutEnforcement;
  overrideReason: string | null;
  lines: ReconcileLineRow[];
  /** Cylinders the caller can see, for the refrigerant lines. Empty when none are tracked. */
  cylinders: ReconcileCylinder[];
}

/** What the person typed for one line. Blank fields arrive as null. */
export interface ReconcileLineInput {
  lineId: string;
  used: number;
  returned: number;
  recovered: number | null;
  reason: string | null;
  /** Refrigerant lines only: the cylinder the refrigerant came from (and a recovery went into). */
  cylinderUnitId?: string | null;
}

/** The materials part of the completion checklist. */
export interface MaterialsGateState {
  required: boolean;
  /** Reconciled, or an office role recorded an override. */
  reconciled: boolean;
  enforcement: CloseoutEnforcement;
}
