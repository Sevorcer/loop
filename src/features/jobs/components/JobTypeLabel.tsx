import { isCallbackJob } from "@/features/jobs/utils/callbackJob";

export function JobTypeLabel({ type }: { type: string }) {
  if (isCallbackJob(type)) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
        Callback
      </span>
    );
  }

  return <span className="text-sm text-slate-200">{type}</span>;
}
