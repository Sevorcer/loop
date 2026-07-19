import { Activity, Clock, Zap } from "lucide-react";

import { formatStartTime } from "../utils/planUtils";

interface ActiveOperationsBannerProps {
  startedAt: string;
}

export function ActiveOperationsBanner({ startedAt }: ActiveOperationsBannerProps) {
  return (
    <div className="rounded-3xl border border-green-500/20 bg-green-500/[0.05] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-500/15 text-green-300">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-200">Operations underway</p>
            <p className="mt-1 text-sm leading-6 text-green-100/70">
              The company has transitioned from planning to execution. Crews are dispatched and the day is live.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-200">
            <Clock className="h-3.5 w-3.5" />
            Started {formatStartTime(startedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] px-3 py-1 text-xs font-medium text-indigo-300">
            <Zap className="h-3.5 w-3.5" />
            Live Operations — coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
