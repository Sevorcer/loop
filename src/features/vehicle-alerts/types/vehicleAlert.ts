export type VehicleAlertStatus =
  | "New"
  | "Acknowledged"
  | "Scheduled"
  | "Resolved";

export type VehicleAlertPriority = "Low" | "Medium" | "High";

export interface VehicleAlert {
  id: string;
  vehicleName: string;
  title: string;
  description: string;
  priority: VehicleAlertPriority;
  status: VehicleAlertStatus;
  reportedBy: string;
  reportedAt: string;
}
