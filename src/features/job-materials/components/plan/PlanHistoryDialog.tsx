"use client";

import { useEffect, useState } from "react";

import { ModalDialog } from "@/components/atlas";
import { companyTimeZone } from "@/lib/timezone";

import { useMaterialPlan } from "../../state/MaterialPlanProvider";
import type { MaterialLineEvent } from "../../types/materialPlan";
import { describeMaterialEvent } from "../../utils/materialPlan";

function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString("en-US", {
    timeZone: companyTimeZone(),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Newest-first history of every change to the plan's lines. */
export function PlanHistoryDialog({ onClose }: { onClose: () => void }) {
  const { loadHistory } = useMaterialPlan();
  const [events, setEvents] = useState<MaterialLineEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadHistory().then((result) => {
      if (cancelled) return;
      if (result === null) setFailed(true);
      else setEvents(result);
    });
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  return (
    <ModalDialog title="Plan history" description="Every add, change, link and removal, newest first." onClose={onClose}>
      {failed ? (
        <p role="alert" className="status-danger rounded-atlas-md px-3 py-2 text-sm">
          Could not load the history.
        </p>
      ) : events === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted">Nothing has changed on this plan yet.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="text-primary">
                <span className="font-medium">{event.lineName}</span> — {describeMaterialEvent(event)}
              </p>
              <p className="text-xs text-muted">
                {[when(event.createdAt), event.reason].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </ModalDialog>
  );
}
