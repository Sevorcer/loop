"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable, EmptyState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { VehicleAlert, VehicleAlertStatus } from "../types/vehicleAlert";
import { buildVehicleAlertColumns } from "./VehicleAlertColumns";
import { VehicleAlertToolbar } from "./VehicleAlertToolbar";

const ALL_FILTER_VALUE = "all";
const PAGE_SIZE = 10;

interface VehicleAlertTableProps {
  alerts: VehicleAlert[];
  onUpdateStatus?: (id: string, status: VehicleAlertStatus) => void;
}

export function VehicleAlertTable({ alerts, onUpdateStatus }: VehicleAlertTableProps) {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [priorityFilter, setPriorityFilter] = useState(ALL_FILTER_VALUE);
  const [vehicleFilter, setVehicleFilter] = useState(ALL_FILTER_VALUE);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const columns = useMemo(
    () => buildVehicleAlertColumns(onUpdateStatus ?? (() => {})),
    [onUpdateStatus]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);

    return () => window.clearTimeout(timer);
  }, []);

  const vehicleOptions = useMemo(() => {
    return Array.from(new Set(alerts.map((alert) => alert.vehicleName))).sort();
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return alerts.filter((alert) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        alert.title.toLowerCase().includes(normalizedSearch) ||
        alert.description.toLowerCase().includes(normalizedSearch) ||
        alert.vehicleName.toLowerCase().includes(normalizedSearch) ||
        alert.reportedBy.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || alert.status === statusFilter;

      const matchesPriority =
        priorityFilter === ALL_FILTER_VALUE ||
        alert.priority === priorityFilter;

      const matchesVehicle =
        vehicleFilter === ALL_FILTER_VALUE ||
        alert.vehicleName === vehicleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesVehicle
      );
    });
  }, [alerts, priorityFilter, searchValue, statusFilter, vehicleFilter]);

  const totalAlerts = filteredAlerts.length;
  const totalPages = Math.max(1, Math.ceil(totalAlerts / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedAlerts = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredAlerts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [safeCurrentPage, filteredAlerts]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    statusFilter !== ALL_FILTER_VALUE ||
    priorityFilter !== ALL_FILTER_VALUE ||
    vehicleFilter !== ALL_FILTER_VALUE;

  const showingFrom = totalAlerts === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const showingTo =
    totalAlerts === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, totalAlerts);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setCurrentPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  function handlePriorityChange(value: string) {
    setPriorityFilter(value);
    setCurrentPage(1);
  }

  function handleVehicleChange(value: string) {
    setVehicleFilter(value);
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearchValue("");
    setStatusFilter(ALL_FILTER_VALUE);
    setPriorityFilter(ALL_FILTER_VALUE);
    setVehicleFilter(ALL_FILTER_VALUE);
    setCurrentPage(1);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <VehicleAlertToolbar
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          priorityFilter={priorityFilter}
          onPriorityChange={handlePriorityChange}
          vehicleFilter={vehicleFilter}
          onVehicleChange={handleVehicleChange}
          vehicleOptions={vehicleOptions}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="rounded-lg border bg-card">
          <div className="space-y-3 p-4">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
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
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          priorityFilter={priorityFilter}
          onPriorityChange={handlePriorityChange}
          vehicleFilter={vehicleFilter}
          onVehicleChange={handleVehicleChange}
          vehicleOptions={vehicleOptions}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <EmptyState
          title="No vehicle alerts found"
          description={
            hasActiveFilters
              ? "We couldn&apos;t find any vehicle alerts matching your current search and filter settings."
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
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        priorityFilter={priorityFilter}
        onPriorityChange={handlePriorityChange}
        vehicleFilter={vehicleFilter}
        onVehicleChange={handleVehicleChange}
        vehicleOptions={vehicleOptions}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {showingFrom}–{showingTo} of {totalAlerts}{" "}
          {totalAlerts === 1 ? "alert" : "alerts"}
        </p>

        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear filters
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
          >
            Previous
          </Button>

          <span className="min-w-[72px] text-center">
            Page {safeCurrentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={safeCurrentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={paginatedAlerts} />
    </div>
  );
}
