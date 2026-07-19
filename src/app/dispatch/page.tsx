import AppShell from "@/components/layout/AppShell";
import { DispatchProvider, DispatchScreen } from "@/features/dispatch";

export default function DispatchPage() {
  return (
    <AppShell>
      <DispatchProvider>
        <DispatchScreen />
      </DispatchProvider>
    </AppShell>
  );
}
