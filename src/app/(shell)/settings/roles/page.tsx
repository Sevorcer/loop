import { RolesScreen } from "@/features/settings";
import { getCurrentOperator } from "@/services/currentOperator";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const { appRole } = await getCurrentOperator();
  if (appRole && appRole !== "owner" && appRole !== "manager") {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Roles settings are not available for your role</h1>
        <p className="text-sm text-slate-400">Role management is limited to owners and managers.</p>
      </div>
    );
  }
  return <RolesScreen />;
}
