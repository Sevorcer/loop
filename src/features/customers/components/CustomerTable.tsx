"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DataTable, EmptyState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { Customer } from "../types/customer";
import { customerColumns } from "./CustomerColumns";
import { CustomerToolbar } from "./CustomerToolbar";

const ALL_FILTER_VALUE = "all";

interface CustomerTableProps {
  /** One server-fetched page of customers (already searched + filtered). */
  customers: Customer[];
  /** Exact total from the repository count for the current search/filters. */
  total: number;
  page: number;
  pageSize: number;
  /** Current `?q=` value. */
  search: string;
  /** Current `?status=` value ("" when unset). */
  statusFilter: string;
  /** Current `?city=` value ("" when unset). */
  cityFilter: string;
  cityOptions: string[];
}

export function CustomerTable({
  customers,
  total,
  page,
  pageSize,
  search,
  statusFilter,
  cityFilter,
  cityOptions,
}: CustomerTableProps) {
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
    search.trim().length > 0 || statusFilter !== "" || cityFilter !== "";

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

  function handleCityChange(value: string) {
    pushParams({
      city: value === ALL_FILTER_VALUE ? null : value,
      page: null,
    });
  }

  function handleClearFilters() {
    setSearchValue("");
    pushParams({ q: null, status: null, city: null, page: null });
  }

  function handlePageChange(nextPage: number) {
    pushParams({ page: nextPage > 1 ? String(nextPage) : null });
  }

  function handleRowClick(customer: Customer) {
    router.push(`/customers/${customer.id}`);
  }

  const toolbar = (
    <CustomerToolbar
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      statusFilter={statusFilter === "" ? ALL_FILTER_VALUE : statusFilter}
      onStatusChange={handleStatusChange}
      cityFilter={cityFilter === "" ? ALL_FILTER_VALUE : cityFilter}
      onCityChange={handleCityChange}
      cityOptions={cityOptions}
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
    />
  );

  if (customers.length === 0) {
    return (
      <div className="space-y-4">
        {toolbar}

        <EmptyState
          title="No customers found"
          description={
            hasActiveFilters
              ? "We couldn't find any customers matching your current search and filter settings."
              : "There are no customers to display yet."
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
      {toolbar}

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {showingFrom}–{showingTo} of {total}{" "}
          {total === 1 ? "customer" : "customers"}
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

      <DataTable columns={customerColumns} data={customers} onRowClick={handleRowClick} disableInternalPagination />
    </div>
  );
}
