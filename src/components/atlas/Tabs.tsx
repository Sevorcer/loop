"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AtlasTabItem<T extends string> {
  key: T;
  label: string;
}

interface AtlasTabsProps<T extends string> {
  items: AtlasTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  sticky?: boolean;
}

export function AtlasTabs<T extends string>({
  items,
  value,
  onChange,
  className,
  sticky = false,
}: AtlasTabsProps<T>) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-0",
        sticky
          ? "sticky top-0 z-10 border-b bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-2 md:px-2"
          : "",
        className
      )}
    >
      {/* Phones wrap every tab onto the next line. Wider screens keep one row. */}
      <div className="overflow-x-auto max-md:overflow-visible">
        <div className="flex min-w-max gap-2 max-md:w-full max-md:min-w-0 max-md:flex-wrap">
          {items.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={value === item.key ? "primary" : "ghost"}
              onClick={() => onChange(item.key)}
              // F14: 44px targets for gloved taps.
              className="min-h-[44px] rounded-full whitespace-nowrap px-4"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
