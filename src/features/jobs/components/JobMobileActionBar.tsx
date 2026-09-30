"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MapPin, PlayCircle } from "lucide-react";

import { useMobileActionBarFlag } from "@/components/mobile/useMobileActionBarFlag";

import type { Job, JobStatus } from "../types/job";
import { buildDirectionsUrl, getPrimaryAdvance } from "../utils/jobMobileActions";

interface JobMobileActionBarProps {
  job: Job;
  onUpdateStatus: (status: JobStatus) => Promise<void> | void;
}

/**
 * F14: sticky thumb-reach action bar for the phone field workflow.
 * One tap to advance the job (Start / Mark Complete / Resume) plus a
 * directions jump — no scrolling back up through the detail page.
 * Renders only on small screens; desktop keeps the full Quick Actions card.
 */
export function JobMobileActionBar({ job, onUpdateStatus }: JobMobileActionBarProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = useMemo(() => getPrimaryAdvance(job.status), [job.status]);
  const directionsUrl = useMemo(() => buildDirectionsUrl(job.location), [job.location]);

  // Lift AppShell's floating FAB stack above this bar so the buttons never overlap.
  useMobileActionBarFlag(Boolean(advance) || Boolean(directionsUrl));

  async function handleAdvance() {
    if (!advance || isUpdating) return;
    try {
      setError(null);
      setIsUpdating(true);
      await onUpdateStatus(advance.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the job. Try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  if (!advance && !directionsUrl) return null;

  const AdvanceIcon = advance?.status === "Completed" ? CheckCircle2 : PlayCircle;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {error ? (
        <p className="border-b border-red-500/20 px-4 py-2 text-xs text-red-300">{error}</p>
      ) : null}
      <div className="flex items-stretch gap-2 p-3">
        {advance ? (
          <button
            type="button"
            onClick={() => void handleAdvance()}
            disabled={isUpdating}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500/90 to-blue-600 px-4 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            <AdvanceIcon className="h-5 w-5" />
            {isUpdating ? "Updating..." : advance.label}
          </button>
        ) : null}
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Get directions to job location"
            className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-slate-200 transition active:scale-[0.98]"
          >
            <MapPin className="h-5 w-5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
