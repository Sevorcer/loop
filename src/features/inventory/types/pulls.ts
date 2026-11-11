// Pull flow (Inventory Lane 4, PR D). A pull is a ledger transfer from the shop to the
// job's pallet (its virtual job location). Nothing here blocks scheduling or dispatch.

export interface PullResult {
  palletLocationId: string;
  pulled: Array<{ lineId: string; itemId: string; qty: number }>;
  /** Claims the shop could not cover physically (a count came in lower); still reserved. */
  short: Array<{ lineId: string; itemId: string; qty: number; onHand: number }>;
}

export interface ReturnPalletResult {
  shopLocationId: string | null;
  returned: Array<{ itemId: string; qty: number }>;
}

export interface PullLineRow {
  lineId: string;
  name: string;
  unit: string;
  itemId: string;
  itemSku: string | null;
  /** Serialized items are picked by unit before they are pulled. Omitted means counted by quantity. */
  trackingMode?: "quantity" | "serialized";
  required: number;
  /** Active reservations, still on the shop shelf. */
  reserved: number;
  /** Already moved to the pallet. */
  pulled: number;
  isOptional: boolean;
}

export interface PullQueueJob {
  jobId: string;
  jobNumber: string;
  jobTitle: string;
  status: string;
  scheduledFor: string | null;
  lines: PullLineRow[];
}

export interface StrandedPallet {
  jobId: string;
  jobNumber: string;
  jobTitle: string;
  jobStatus: string;
  items: Array<{ itemId: string; itemName: string; unit: string | null; onHand: number }>;
}

export const MATERIAL_EVENT_TYPES = [
  "missing_part",
  "wrong_part",
  "substitution",
  "unplanned_use",
  "supply_house_run",
  "kit_feedback",
] as const;
export type MaterialEventType = (typeof MATERIAL_EVENT_TYPES)[number];

export const MATERIAL_EVENT_LABELS: Record<MaterialEventType, string> = {
  missing_part: "Missing part",
  wrong_part: "Wrong part",
  substitution: "Used a substitute",
  unplanned_use: "Used something unplanned",
  supply_house_run: "Bought on the way",
  kit_feedback: "Kit feedback",
};

export interface MaterialEventInput {
  eventType: MaterialEventType;
  lineId: string | null;
  itemId: string | null;
  qty: number | null;
  note: string | null;
}
