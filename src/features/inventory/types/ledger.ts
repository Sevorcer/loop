/**
 * Locations, vehicles, stock cache and the append-only ledger (Inventory Lane 1).
 *
 * Quantity only ever changes by appending a LedgerEntry. Stock levels are a
 * cache maintained by a database trigger; corrections, cancellations and
 * returns are opposite entries, never edits.
 */

export const LOCATION_TYPES = ["warehouse", "van", "job", "quarantine"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const VEHICLE_STATUSES = ["active", "out_of_service", "retired"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const TXN_TYPES = [
  "receive",
  "transfer_out",
  "transfer_in",
  "issue_to_job",
  "return_from_job",
  "adjust",
  "count",
  "buy_for_job",
  "reversal",
] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export interface Vehicle {
  id: string;
  name: string;
  plate: string | null;
  vin: string | null;
  status: VehicleStatus;
  crewId: string | null;
  notes: string | null;
}

export interface VehicleInput {
  name: string;
  plate?: string | null;
  vin?: string | null;
  status?: VehicleStatus;
  crewId?: string | null;
  notes?: string | null;
}

export interface InventoryLocation {
  id: string;
  type: LocationType;
  name: string;
  parentLocationId: string | null;
  vehicleId: string | null;
  jobId: string | null;
  address: string | null;
  isActive: boolean;
}

export interface InventoryLocationInput {
  /** Only warehouse and quarantine are created directly; vans come with a vehicle, job locations with a buy-for-job. */
  type: "warehouse" | "quarantine";
  name: string;
  parentLocationId?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface StockLevel {
  itemId: string;
  locationId: string;
  onHand: number;
  minQty: number | null;
  maxQty: number | null;
  updatedAt: string;
}

/** A ledger row as stored. Costs are included only for roles that may see them (none are tech/portal in Lane 1). */
export interface LedgerEntry {
  id: string;
  txnType: TxnType;
  itemId: string;
  locationId: string;
  qtyDelta: number;
  jobId: string | null;
  transferGroupId: string | null;
  reversesTransactionId: string | null;
  reason: string | null;
  unitCostCents: number | null;
  /** The serialized unit this entry moved (always one unit, quantity 1), or null for counted stock. */
  serialUnitId?: string | null;
  createdBy: string;
  createdAt: string;
}

/** A ledger row about to be appended (what the pure rules produce). */
export interface NewLedgerRow {
  txnType: TxnType;
  itemId: string;
  locationId: string;
  qtyDelta: number;
  jobId?: string | null;
  transferGroupId?: string | null;
  reversesTransactionId?: string | null;
  reason?: string | null;
  unitCostCents?: number | null;
  serialUnitId?: string | null;
}

/** Commands the UI/API can post; each expands into one or more NewLedgerRows. */
export type LedgerCommand =
  | {
      kind: "receive";
      itemId: string;
      locationId: string;
      /** Counted items: the quantity. Serialized items: derived from `serialNumbers`. */
      qty?: number;
      /** Serialized items: one serial per unit received. */
      serialNumbers?: string[];
      unitCostCents?: number | null;
      reason?: string | null;
    }
  | { kind: "adjust"; itemId: string; locationId: string; qtyDelta: number; reason: string }
  | { kind: "count"; itemId: string; locationId: string; countedQty: number; reason?: string | null }
  | { kind: "transfer"; itemId: string; fromLocationId: string; toLocationId: string; qty: number; reason?: string | null }
  | { kind: "issue_to_job"; itemId: string; locationId: string; jobId: string; qty: number }
  | { kind: "return_from_job"; itemId: string; locationId: string; jobId: string; qty: number }
  | { kind: "reverse"; transactionId: string; reason: string };

export interface LedgerFilters {
  itemId?: string;
  locationId?: string;
  jobId?: string;
  txnType?: TxnType;
  limit?: number;
}
