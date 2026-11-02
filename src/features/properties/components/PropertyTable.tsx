"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DataTable } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { Property } from "../types/property";
import { propertyColumns } from "./PropertyColumns";
import { PropertyToolbar } from "./PropertyToolbar";

const ALL_FILTER_VALUE = "all";

interface PropertyTableProps {
  /** One server-fetched page of properties (already searched + filtered). */
  properties: Property[];
  /** Exact total from the repository count for the current search/filters. */
  total: number;
  page: number;
  pageSize: number;
  /** Current `?q=` value. */
  search: string;
  /** Current `?status=` value ("" when unset). */
  statusFilter: string;
  /** Current `?type=` value ("" when unset). */
  typeFilter: string;
  /** Current `?city=` value ("" when unset). */
  cityFilter: string;
  cityOptions: string[];
}

export function PropertyTable({
  properties,
  total,
  page,
  pageSize,
  search,
  statusFilter,
  typeFilter,
  cityFilter,
  cityOptions,
}: PropertyTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(search);
  // Sync the input when the URL changes elsewhere (back/forward, clear
  // filters) — adjusted during render, per the React docs pattern.
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    setSearchValue(search);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(page, totalPages);
  const showingFrom = total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(safeCurrentPage * pageSize, total);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "" ||
    typeFilter !== "" ||
    cityFilter !== "";

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Debounced search: the URL is the source of truth, so typing re-runs the
  // server-side search instead of filtering the loaded page in memory.
  useEffect(() => {
    if (searchValue === search) return;
    const timer = setTimeout(() => {
      pushParams({ q: searchValue.trim() || null, page: null });
    }, 300);
    return () => clearTimeout(timer);
  }, [pushParams, search, searchValue]);

  function handleStatusChange(value: string) {
    pushParams({
      status: value === ALL_FILTER_VALUE ? null : value,
      page: null,
    });
  }

  function handleTypeChange(value: string) {
    pushParams({
      type: value === ALL_FILTER_VALUE ? null : value,
      page: null,
    });
  }

  function handleCityChange(value: string) {
    pushParams({
      city: value === ALL_FILTER_VALUE ? null : value,
      page: null,
    });
  }

  function handleClearFilters() {
    setSearchValue("");
    pushParams({ q: null, status: null, type: null, city: null, page: null });
  }

  function handlePageChange(nextPage: number) {
    pushParams({ page: nextPage > 1 ? String(nextPage) : null });
  }

  function handleRowClick(property: Property) {
    router.push(`/properties/${property.id}`);
  }

  const toolbar = (
    <PropertyToolbar
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      statusFilter={statusFilter === "" ? ALL_FILTER_VALUE : statusFilter}
      onStatusChange={handleStatusChange}
      typeFilter={typeFilter === "" ? ALL_FILTER_VALUE : typeFilter}
      onTypeChange={handleTypeChange}
      cityFilter={cityFilter === "" ? ALL_FILTER_VALUE : cityFilter}
      onCityChange={handleCityChange}
      cityOptions={cityOptions}
      onClearFilters={handleClearFilters}
    />
  );

  if (properties.length === 0) {
    return (
      <div className="space-y-4">
        {toolbar}

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No properties found</h3>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            We couldn&apos;t find any properties matching your current search and
            filter settings.
          </p>

          {hasActiveFilters ? (
            <Button variant="outline" className="mt-6" onClick={handleClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {showingFrom}–{showingTo} of {total}{" "}
          {total === 1 ? "property" : "properties"}
        </p>

        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={handleClearFilters}>
              Clear filters
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => handlePageChange(safeCurrentPage - 1)}
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
            className="min-h-[44px]"
            onClick={() => handlePageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <DataTable columns={propertyColumns} data={properties} onRowClick={handleRowClick} disableInternalPagination />
    </div>
  );
}
