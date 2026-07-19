"use client";

import { Search } from "lucide-react";

type PropertyToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  cityFilter: string;
  onCityChange: (value: string) => void;
  cityOptions: string[];
  onClearFilters: () => void;
};

const statusOptions = ["all", "Active", "Pending", "Inactive"];
const typeOptions = ["all", "Residential", "Multi-Family", "Commercial"];

export function PropertyToolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  cityFilter,
  onCityChange,
  cityOptions,
}: PropertyToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 md:gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search properties, customers, address, city, or system..."
          className="h-10 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <select
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(event) => onTypeChange(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type === "all" ? "All types" : type}
            </option>
          ))}
        </select>

        <select
          value={cityFilter}
          onChange={(event) => onCityChange(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          <option value="all">All cities</option>

          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}