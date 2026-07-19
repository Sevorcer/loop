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
        "space-y-0",
        sticky
          ? "sticky top-0 z-10 -mx-2 border-b bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          : "",
        className
      )}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {items.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={value === item.key ? "primary" : "ghost"}
              onClick={() => onChange(item.key)}
              className="rounded-full whitespace-nowrap px-4"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}