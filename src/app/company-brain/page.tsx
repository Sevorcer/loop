import AppShell from "@/components/layout/AppShell";
import {
  CompanyBrainProvider,
  CompanyBrainScreen,
} from "@/features/company-brain";

export default function CompanyBrainPage() {
  return (
    <AppShell>
      <CompanyBrainProvider>
        <CompanyBrainScreen />
      </CompanyBrainProvider>
    </AppShell>
  );
}
