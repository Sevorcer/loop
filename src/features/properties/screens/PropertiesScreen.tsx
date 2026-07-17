import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PageHeader,
  SectionCard,
} from "@/components/atlas";

import { PropertyTable } from "../components/PropertyTable";

export function PropertiesScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage every property, customer location, and installed HVAC system across your company."
        actions={
          <Button className="gap-2">
            <Building2 className="h-4 w-4" />
            New Property
          </Button>
        }
      />

      <SectionCard
        title="Property Directory"
        description="Search, filter, and organize every serviced property in one place."
      >
        <PropertyTable />
      </SectionCard>
    </div>
  );
}