"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    <div className="border-default bg-surface flex items-center justify-between border-b px-6 py-4">

      <div className="relative w-full max-w-sm">

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

      <div className="ml-4 flex items-center gap-2">

        {primaryAction}

      </div>

    </div>
  );
}