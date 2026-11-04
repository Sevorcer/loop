"use client";

import type { PortalTimelineEvent } from "../types/gcPortal";

interface GcPortalTimelineProps {
  events: PortalTimelineEvent[];
}

export function GcPortalTimeline({ events }: GcPortalTimelineProps) {
  return (
    <div className="flex flex-col gap-0">
      {events.map((event, index) => (
        <div key={event.id} className="relative flex gap-4 pb-6">
          {/* Timeline line */}
          {index < events.length - 1 && (
            <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
          )}
          {/* Dot */}
          <div className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
          {/* Content */}
          <div className="flex-1">
            <p className="text-sm text-foreground">{event.description}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatEventDate(event.occurredAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatEventDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
