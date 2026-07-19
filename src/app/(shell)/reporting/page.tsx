import { ReportingProvider, ReportingScreen } from "@/features/reporting";

export default function ReportingPage() {
  return (
    <ReportingProvider>
      <ReportingScreen />
    </ReportingProvider>
  );
}
