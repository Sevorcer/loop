import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AtlasTimelineItem {
  id: string;
  title: string;
  date: string;
  description?: string;
  icon?: LucideIcon;
}

interface AtlasTimelineProps {
  items: AtlasTimelineItem[];
  className?: string;
}

export function AtlasTimeline({
  items,
  className,
}: AtlasTimelineProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {items.map((item, index) => {
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

              {index < items.length - 1 ? (
                <div className="mt-2 h-full w-px bg-border" />
              ) : null}
            </div>

            <div className="pb-2">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.date}
              </p>

              {item.description ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}