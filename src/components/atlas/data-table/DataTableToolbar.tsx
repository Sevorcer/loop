"use client";

import { Search } from "lucide-react";

interface DataTableToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  primaryAction?: React.ReactNode;
}

export function DataTableToolbar({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  primaryAction,
}: DataTableToolbarProps) {
  return (
    <div className="border-default bg-surface flex flex-col gap-3 border-b px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-sm">
        <Search
          className="text-muted absolute left-3 top-1/2 -translate-y-1/2"
          size={16}
        />

        <input
          type="text"
          value={searchValue}
          placeholder={searchPlaceholder}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="
            bg-background
            border-default
            text-primary
            placeholder:text-muted
            min-h-[44px]
            w-full
            rounded-atlas-lg
            border
            py-2
            pl-10
            pr-3
            outline-none
            transition-atlas
            focus:border-primary
          "
        />
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-4 lg:w-auto lg:justify-end">
        {primaryAction}
      </div>
    </div>
  );
}