export type VehicleAlertStatus =
  | "New"
  | "Acknowledged"
  | "Scheduled"
  | "Resolved";

export type VehicleAlertPriority = "Low" | "Medium" | "High";

export interface VehicleAlert {
  id: string;
  /** Display name of the linked vehicle. */
  vehicleName: string;
  /** The `vehicles` row this alert is about (required since M4). */
  vehicleId: string;
  title: string;
  description: string;
  priority: VehicleAlertPriority;
  status: VehicleAlertStatus;
  reportedBy: string;
  reportedAt: string;
}
