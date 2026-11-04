import { FeedbackTriageScreen } from "@/features/feedback";
import { getCurrentOperator } from "@/services/currentOperator";

export const dynamic = "force-dynamic";

export default async function SettingsFeedbackPage() {
  const { appRole } = await getCurrentOperator();
  if (appRole && appRole !== "owner" && appRole !== "manager") {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Feedback settings are not available for your role</h1>
        <p className="text-sm text-slate-400">
          Feedback triage is limited to owners and managers. Your jobs and calendar are still available from the sidebar.
        </p>
      </div>
    );
  }
  return <FeedbackTriageScreen />;
}
