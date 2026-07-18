"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DataTable, EmptyState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { mockCustomers } from "../data/mockCustomers";
import type { Customer } from "../types/customer";
import { customerColumns } from "./CustomerColumns";
import { CustomerToolbar } from "./CustomerToolbar";

const ALL_FILTER_VALUE = "all";
const PAGE_SIZE = 10;

export function CustomerTable() {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [cityFilter, setCityFilter] = useState(ALL_FILTER_VALUE);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);

    return () => window.clearTimeout(timer);
  }, []);

  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(mockCustomers.map((customer) => customer.city))
    ).sort();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return mockCustomers.filter((customer) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.primaryContact.toLowerCase().includes(normalizedSearch) ||
        customer.email.toLowerCase().includes(normalizedSearch) ||
        customer.phone.toLowerCase().includes(normalizedSearch) ||
        customer.city.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || customer.status === statusFilter;

      const matchesCity =
        cityFilter === ALL_FILTER_VALUE || customer.city === cityFilter;

      return matchesSearch && matchesStatus && matchesCity;
    });
  }, [cityFilter, searchValue, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, statusFilter, cityFilter]);

  const totalCustomers = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredCustomers]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    statusFilter !== ALL_FILTER_VALUE ||
    cityFilter !== ALL_FILTER_VALUE;

  const showingFrom =
    totalCustomers === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo =
    totalCustomers === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalCustomers);

  function handleClearFilters() {
    setSearchValue("");
    setStatusFilter(ALL_FILTER_VALUE);
    setCityFilter(ALL_FILTER_VALUE);
    setCurrentPage(1);
  }

  function handleRowClick(customer: Customer) {
    router.push(`/customers/${customer.id}`);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CustomerToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          cityFilter={cityFilter}
          onCityChange={setCityFilter}
          cityOptions={cityOptions}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="rounded-lg border bg-card">
          <div className="space-y-3 p-4">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (filteredCustomers.length === 0) {
    return (
      <div className="space-y-4">
        <CustomerToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          cityFilter={cityFilter}
          onCityChange={setCityFilter}
          cityOptions={cityOptions}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <EmptyState
          title="No customers found"
          description={
            hasActiveFilters
              ? "We couldn&apos;t find any customers matching your current search and filter settings."
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
      <CustomerToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        cityFilter={cityFilter}
        onCityChange={setCityFilter}
        cityOptions={cityOptions}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {showingFrom}–{showingTo} of {totalCustomers}{" "}
          {totalCustomers === 1 ? "customer" : "customers"}
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
            disabled={currentPage === 1}
          >
            Previous
          </Button>

          <span className="min-w-[72px] text-center">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <DataTable
        columns={customerColumns}
        data={paginatedCustomers}
        onRowClick={handleRowClick}
      />
    </div>
  );
}