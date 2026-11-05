import type { ReactNode } from "react";
import Link from "next/link";

import { ROUTE_BUILDERS } from "@/lib/routes";

import type { FollowUpItem } from "../types/followUp";
import { formatFollowUpMarker } from "../utils/followUpFormat";

interface FollowUpRowProps {
  item: FollowUpItem;
  /** Right-hand action, e.g. the unmark button. */
  action?: ReactNode;
}

/** One open follow-up: job, customer, note, who/when. The title links to the job. */
export function FollowUpRow({ item, action }: FollowUpRowProps) {
  const marker = formatFollowUpMarker(item.markedAt, item.markedByName);
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 md:px-6">
      <div className="min-w-0 space-y-0.5">
        <Link
          href={ROUTE_BUILDERS.JOB_DETAIL(item.jobId)}
          className="block truncate text-sm font-semibold text-white transition-colors hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {item.jobNumber ? `${item.jobNumber} · ` : ""}
          {item.title || "Untitled job"}
        </Link>
        <p className="truncate text-xs text-slate-400">
          {[item.customerName, item.propertyName].filter(Boolean).join(" · ")}
          {item.status ? ` · ${item.status}` : ""}
        </p>
        {item.note ? <p className="whitespace-pre-line break-words text-sm text-slate-200">{item.note}</p> : null}
        {marker ? <p className="text-[11px] text-slate-500">{marker}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  );
}
