import { redirect } from "next/navigation";
import { getSettingsLandingHref } from "@/features/settings";
import { getCurrentOperator } from "@/services/currentOperator";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { appRole } = await getCurrentOperator();
  redirect(getSettingsLandingHref(appRole));
}
