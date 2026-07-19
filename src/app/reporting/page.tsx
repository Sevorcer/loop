import AppShell from "@/components/layout/AppShell";
import { ReportingProvider, ReportingScreen } from "@/features/reporting";

export default function ReportingPage() {
  return (
    <AppShell>
      <ReportingProvider>
        <ReportingScreen />
      </ReportingProvider>
    </AppShell>
  );
}
