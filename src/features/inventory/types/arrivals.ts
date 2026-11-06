export type ArrivalStatus = "expected" | "received" | "cancelled";

export const ARRIVAL_STATUSES: readonly ArrivalStatus[] = ["expected", "received", "cancelled"];

/** What is on its way (plan §2.9). The Lane 4 on-order source until purchasing exists. */
export interface ExpectedArrival {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  unit: string | null;
  locationId: string;
  locationName: string;
  qty: number;
  etaDate: string;
  status: ArrivalStatus;
  forJobId: string | null;
  /** "123 · Smith install" for a special order, when the job is readable. */
  forJobLabel: string | null;
  supplierNote: string | null;
  receiptTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArrivalCreateInput {
  itemId: string;
  locationId: string | null;
  qty: number;
  etaDate: string;
  forJobId: string | null;
  supplierNote: string | null;
}

export interface ArrivalPatch {
  qty?: number;
  etaDate?: string;
  forJobId?: string | null;
  supplierNote?: string | null;
  /** Cancels an open arrival (it stays as history). */
  cancel?: boolean;
}
