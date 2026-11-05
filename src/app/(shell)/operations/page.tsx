import { CommandCenterScreen } from "@/features/command-center";

/**
 * Operations — the former Command Center (renamed 2026-11-05). The old
 * /operations launcher hub that lived here only repeated sidebar links and
 * was removed. Role access (no techs, no portal users) is enforced by the
 * proxy via shellAccess.ts, exactly as it was for /command-center.
 *
 * 60-second revalidation provides stable, jitter-free refresh behavior
 * suitable for always-open usage throughout the business day.
 */
export const revalidate = 60;

export default function OperationsPage() {
  return <CommandCenterScreen />;
}
