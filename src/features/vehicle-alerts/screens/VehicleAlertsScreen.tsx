import { BellRing } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { VehicleAlertTable } from "../components/VehicleAlertTable";

export function VehicleAlertsScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Alerts"
        description="Track installer-reported vehicle issues, maintenance reminders, and office follow-up items in one place."
        actions={
          <Button className="gap-2">
            <BellRing className="h-4 w-4" />
            Report Alert
          </Button>
        }
      />

      <SectionCard
        title="Operations Alert Board"
        description="Review new vehicle issues, acknowledge them, and track follow-up across the fleet."
      >
        <VehicleAlertTable />
      </SectionCard>
    </div>
  );
}
