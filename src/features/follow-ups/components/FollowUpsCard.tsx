import { CalendarCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listFollowUps } from "@/services/jobFollowUps";

import type { FollowUpItem } from "../types/followUp";
import { FollowUpRow } from "./FollowUpRow";
import { FollowUpUnmarkButton } from "./FollowUpUnmarkButton";

const DASHBOARD_LIMIT = 8;

/**
 * Dashboard section listing open follow-ups (part on order / return visit).
 * Separate from Needs Attention on purpose. Server component; renders nothing
 * when the list cannot be read so the dashboard never breaks.
 */
export async function FollowUpsCard() {
  let items: FollowUpItem[] = [];
  try {
    items = await listFollowUps();
  } catch {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Follow-ups
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-300">{items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">Nothing waiting on a part or a return visit.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.slice(0, DASHBOARD_LIMIT).map((item) => (
              <FollowUpRow key={item.jobId} item={item} action={<FollowUpUnmarkButton jobId={item.jobId} />} />
            ))}
          </ul>
        )}
        {items.length > DASHBOARD_LIMIT ? (
          <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-500">
            Showing {DASHBOARD_LIMIT} of {items.length}. See the rest under Follow-ups on the Jobs board.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
