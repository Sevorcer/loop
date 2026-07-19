"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { mockVehicleAlerts } from "../data/mockVehicleAlerts";
import { type VehicleAlert, type VehicleAlertPriority, type VehicleAlertStatus } from "../types/vehicleAlert";
import { VehicleAlertToolbar } from "./VehicleAlertToolbar";

const ALL_FILTER_VALUE = "all";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getPriorityVariant(priority: VehicleAlertPriority) {
  if (priority === "High") return "destructive" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function getStatusVariant(status: VehicleAlertStatus) {
  if (status === "Resolved") return "success" as const;
  if (status === "Scheduled") return "warning" as const;
  if (status === "Acknowledged") return "neutral" as const;
  return "destructive" as const;
}

function VehicleAlertRow({ alert }: { alert: VehicleAlert }) {
  return (
    <tr className="border-b border-slate-200 last:border-0">
      <td className="px-4 py-4 align-top">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
            <AlertTriangle className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <div className="font-medium text-slate-950">{alert.title}</div>
            <div className="text-xs text-slate-500">{alert.vehicleName}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">{alert.description}</td>
      <td className="px-4 py-4">
        <StatusBadge variant={getPriorityVariant(alert.priority)}>
          {alert.priority}
        </StatusBadge>
      </td>
      <td className="px-4 py-4">
        <StatusBadge variant={getStatusVariant(alert.status)}>{alert.status}</StatusBadge>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">{alert.reportedBy}</td>
      <td className="px-4 py-4 text-sm text-slate-600">{formatDate(alert.reportedAt)}</td>
    </tr>
  );
}

export function VehicleAlertTable() {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [priorityFilter, setPriorityFilter] = useState(ALL_FILTER_VALUE);
  const [vehicleFilter, setVehicleFilter] = useState(ALL_FILTER_VALUE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);

    return () => window.clearTimeout(timer);
  }, []);

  const vehicleOptions = useMemo(() => {
    return Array.from(
      new Set(mockVehicleAlerts.map((alert) => alert.vehicleName))
    ).sort();
  }, []);

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return mockVehicleAlerts.filter((alert) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        alert.title.toLowerCase().includes(normalizedSearch) ||
        alert.description.toLowerCase().includes(normalizedSearch) ||
        alert.vehicleName.toLowerCase().includes(normalizedSearch) ||
        alert.reportedBy.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || alert.status === statusFilter;
      const matchesPriority =
        priorityFilter === ALL_FILTER_VALUE || alert.priority === priorityFilter;
      const matchesVehicle =
        vehicleFilter === ALL_FILTER_VALUE || alert.vehicleName === vehicleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesVehicle
      );
    });
  }, [priorityFilter, searchValue, statusFilter, vehicleFilter]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    statusFilter !== ALL_FILTER_VALUE ||
    priorityFilter !== ALL_FILTER_VALUE ||
    vehicleFilter !== ALL_FILTER_VALUE;

  function handleClearFilters() {
    setSearchValue("");
    setStatusFilter(ALL_FILTER_VALUE);
    setPriorityFilter(ALL_FILTER_VALUE);
    setVehicleFilter(ALL_FILTER_VALUE);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <VehicleAlertToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityChange={setPriorityFilter}
          vehicleFilter={vehicleFilter}
          onVehicleChange={setVehicleFilter}
          vehicleOptions={vehicleOptions}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (filteredAlerts.length === 0) {
    return (
      <div className="space-y-4">
        <VehicleAlertToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityChange={setPriorityFilter}
          vehicleFilter={vehicleFilter}
          onVehicleChange={setVehicleFilter}
          vehicleOptions={vehicleOptions}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <EmptyState
          title="No vehicle alerts found"
          description={
            hasActiveFilters
              ? "We couldn’t find any vehicle alerts matching your current filters."
              : "No vehicle alerts have been reported yet."
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VehicleAlertToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        vehicleFilter={vehicleFilter}
        onVehicleChange={setVehicleFilter}
        vehicleOptions={vehicleOptions}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>
          Showing {filteredAlerts.length} {filteredAlerts.length === 1 ? "alert" : "alerts"}
        </p>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Alert</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reported By</th>
                <th className="px-4 py-3 font-semibold">Reported</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <VehicleAlertRow key={alert.id} alert={alert} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
