"use client";

import { MessageCircle } from "lucide-react";

import { StaleBanner } from "../components/StaleBanner";
import { usePortal } from "../state/PortalProvider";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Timeline screen — Sprint 22A MVP.
 *
 * Displays completed milestones in chronological order.
 * Projection is built from milestone.completed events.
 *
 * Loading state: not applicable in mock — projection is synchronous.
 * Empty state: rendered when no milestone events have been processed yet.
 * Error state: delegated to parent layout (auth guard).
 */
export function TimelineScreen() {
  const { projection, permissionSet } = usePortal();
  const { timeline, freshness } = projection;

  if (!permissionSet?.canViewTimeline) return null;

  const entries = timeline?.entries ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <StaleBanner freshness={freshness} />

      {entries.length === 0 ? (
        // ES-07 — Empty Timeline
        <div
          className="flex flex-col items-center justify-center py-20 text-center"
          aria-label="No timeline activity"
        >
          <div
            aria-hidden="true"
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No timeline activity yet.
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Your project timeline will appear here as work progresses. Check
            back soon.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border sm:left-[23px]" />

          <ol className="space-y-6" aria-label="Project milestones">
            {entries.map((entry, idx) => (
              <li key={entry.id} className="relative flex gap-4 sm:gap-5">
                {/* Timeline dot */}
                <div
                  className={[
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold sm:h-12 sm:w-12",
                    idx === entries.length - 1
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {entry.milestoneSequence}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2 pt-1.5 sm:pt-2">
                  <p className="text-sm font-semibold text-foreground">
                    {entry.milestoneName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(entry.completedAt)} · {entry.completedBy}
                  </p>
                  {entry.notesForPortal ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {entry.notesForPortal}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Contact CTA at bottom of empty state */}
      {entries.length === 0 ? (
        <div className="flex justify-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            Contact Team
          </a>
        </div>
      ) : null}
    </div>
  );
}
