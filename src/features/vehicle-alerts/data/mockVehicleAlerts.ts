import type { VehicleAlert } from "../types/vehicleAlert";

export const mockVehicleAlerts: VehicleAlert[] = [
  {
    id: "VA-1001",
    vehicleName: "Install Van 4",
    title: "Oil change due soon",
    description:
      "Crew noted the service reminder is active and the van should be scheduled for an oil change this week.",
    priority: "Medium",
    status: "New",
    reportedBy: "Luis M.",
    reportedAt: "2026-07-18",
  },
  {
    id: "VA-1002",
    vehicleName: "Install Truck 2",
    title: "Rear tire leaking slowly",
    description:
      "Passenger-side rear tire is losing pressure over the course of the day and should be inspected before the next long route.",
    priority: "High",
    status: "Acknowledged",
    reportedBy: "Tanner R.",
    reportedAt: "2026-07-17",
  },
  {
    id: "VA-1003",
    vehicleName: "Service Van 7",
    title: "Windshield wipers need replacement",
    description:
      "Wipers are streaking badly in rain and should be replaced before the next storm day.",
    priority: "Low",
    status: "New",
    reportedBy: "Chris D.",
    reportedAt: "2026-07-16",
  },
  {
    id: "VA-1004",
    vehicleName: "Install Van 1",
    title: "Brake light out",
    description:
      "Driver-side rear brake light appears out and should be replaced before the next dispatch block.",
    priority: "High",
    status: "Scheduled",
    reportedBy: "Maya S.",
    reportedAt: "2026-07-15",
  },
  {
    id: "VA-1005",
    vehicleName: "Warehouse Pickup 3",
    title: "Cabin AC weak",
    description:
      "Cooling is weak during afternoon runs. Not urgent for dispatch today, but should be checked soon.",
    priority: "Low",
    status: "Resolved",
    reportedBy: "Jeremy K.",
    reportedAt: "2026-07-11",
  },
];
