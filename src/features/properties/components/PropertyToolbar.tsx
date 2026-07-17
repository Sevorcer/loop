"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PropertyToolbar() {
  return (
    <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="text"
          placeholder="Search properties..."
          className="h-10 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline">
          Status
        </Button>

        <Button variant="outline">
          City
        </Button>

        <Button variant="outline">
          Type
        </Button>
      </div>
    </div>
  );
}