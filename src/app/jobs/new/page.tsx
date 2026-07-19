import AppShell from "@/components/layout/AppShell";
import { JobFormScreen } from "@/features/jobs";

export default function NewJobPage() {
  return (
    <AppShell>
      <JobFormScreen mode="create" />
    </AppShell>
  );
}
