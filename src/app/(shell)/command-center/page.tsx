import { CommandCenterScreen } from "@/features/command-center";

/**
 * 60-second revalidation provides stable, jitter-free refresh behavior
 * suitable for always-open usage throughout the business day.
 */
export const revalidate = 60;

export default function CommandCenterPage() {
  return <CommandCenterScreen />;
}
