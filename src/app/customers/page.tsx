import AppShell from "@/components/layout/AppShell";
import { CustomersScreen } from "@/features/customers";

export default function CustomersPage() {
  return (
    <AppShell>
      <CustomersScreen />
    </AppShell>
  );
}