import AppShell from "@/components/layout/AppShell";
import { JobFormScreen } from "@/features/jobs";

export default function EditJobPage() {
  return (
    <AppShell>
      <JobFormScreen mode="edit" />
    </AppShell>
  );
}
