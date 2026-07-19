import type { ReactNode } from "react";

import { VehicleAlertsProvider } from "@/features/vehicle-alerts/state/VehicleAlertsProvider";

export default function VehicleAlertsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <VehicleAlertsProvider>{children}</VehicleAlertsProvider>;
}
