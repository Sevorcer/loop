"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

type CustomerToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  cityFilter: string;
  onCityChange: (value: string) => void;
  cityOptions: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

const statusOptions = ["all", "Active", "Prospect", "Inactive"];

export function CustomerToolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  cityFilter,
  onCityChange,
  cityOptions,
  onClearFilters,
  hasActiveFilters,
}: CustomerToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="relative w-full xl:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search customers, contacts, email, phone, or city..."
          className="h-11 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
          className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status}
            </option>
          ))}
        </select>

        <select
          value={cityFilter}
          onChange={(event) => onCityChange(event.target.value)}
          className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          <option value="all">All cities</option>

          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        {hasActiveFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}