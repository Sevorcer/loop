export type VehicleAlertStatus =
  | "New"
  | "Acknowledged"
  | "Scheduled"
  | "Resolved";

export type VehicleAlertPriority = "Low" | "Medium" | "High";

export interface VehicleAlert {
  id: string;
  /** Display name: the linked vehicle, else the legacy text on the row (until M4). */
  vehicleName: string;
  /** Linked `vehicles` row, or null for legacy/unlinked alerts. */
  vehicleId?: string | null;
  title: string;
  description: string;
  priority: VehicleAlertPriority;
  status: VehicleAlertStatus;
  reportedBy: string;
  reportedAt: string;
}
