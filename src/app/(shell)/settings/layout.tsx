import type { ReactNode } from "react";
import { SettingsShell } from "@/features/settings";
import { getCurrentOperator } from "@/services/currentOperator";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { appRole } = await getCurrentOperator();
  return <SettingsShell appRole={appRole}>{children}</SettingsShell>;
}
