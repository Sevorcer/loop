"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

type VehicleAlertToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
  vehicleFilter: string;
  onVehicleChange: (value: string) => void;
  vehicleOptions: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

const statusOptions = ["all", "New", "Acknowledged", "Scheduled", "Resolved"];
const priorityOptions = ["all", "High", "Medium", "Low"];

export function VehicleAlertToolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  vehicleFilter,
  onVehicleChange,
  vehicleOptions,
  onClearFilters,
  hasActiveFilters,
}: VehicleAlertToolbarProps) {
  return (
    <div className="flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="relative w-full xl:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search alerts, vehicles, issues, or crew..."
          className="h-10 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => onPriorityChange(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          {priorityOptions.map((priority) => (
            <option key={priority} value={priority}>
              {priority === "all" ? "All priorities" : priority}
            </option>
          ))}
        </select>

        <select
          value={vehicleFilter}
          onChange={(event) => onVehicleChange(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          <option value="all">All vehicles</option>

          {vehicleOptions.map((vehicle) => (
            <option key={vehicle} value={vehicle}>
              {vehicle}
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
