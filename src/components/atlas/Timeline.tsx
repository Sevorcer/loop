import { type LucideIcon } from "lucide-react";
import Link from "next/link";

import {
  compareTimelineEventsDesc,
  formatTimelineTimestamp,
  type TimelineEventItem,
} from "@/lib/timeline";
import { cn } from "@/lib/utils";

export interface AtlasTimelineItem extends TimelineEventItem {
  icon?: LucideIcon;
  sourceLabel?: string;
}

interface AtlasTimelineProps {
  items: AtlasTimelineItem[];
  className?: string;
}

export function AtlasTimeline({
  items,
  className,
}: AtlasTimelineProps) {
  const orderedItems = [...items].sort(compareTimelineEventsDesc);

  return (
    <div className={cn("space-y-6", className)}>
      {orderedItems.map((item, index) => {
        const Icon = item.icon;

        return (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background">
                {Icon ? (
                  <Icon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>

              {index < orderedItems.length - 1 ? (
                <div className="mt-2 h-full w-px bg-border" />
              ) : null}
            </div>

            <div className="pb-2">
              <p className="font-medium">{item.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{formatTimelineTimestamp(item.occurredAt)}</span>
                {item.sourceLabel ? (
                  <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {item.sourceLabel}
                  </span>
                ) : null}
                {item.actor ? (
                  <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    Actor: {item.actor}
                  </span>
                ) : null}
              </div>

              {item.description ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}

              {item.href ? (
                <Link
                  href={item.href}
                  className="mt-2 inline-flex text-sm font-medium text-primary transition-opacity hover:opacity-80"
                >
                  {item.hrefLabel ?? "Open source record"}
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}