import { UserPlus } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { CustomerTable } from "../components/CustomerTable";

export function CustomersScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer accounts, primary contacts, and service relationships across every property you support."
        actions={
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            New Customer
          </Button>
        }
      />

      <SectionCard
        title="Customer Directory"
        description="Search, filter, and organize every customer account in one place."
      >
        <CustomerTable />
      </SectionCard>
    </div>
  );
}