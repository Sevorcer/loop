"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DataTable, ErrorState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { useProperties } from "../state/PropertiesProvider";
import type { Property } from "../types/property";
import { propertyColumns } from "./PropertyColumns";
import { PropertyToolbar } from "./PropertyToolbar";

const ALL_FILTER_VALUE = "all";

export function PropertyTable() {
  const router = useRouter();
  const { hydrated, loading, error, refreshProperties, properties } = useProperties();

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER_VALUE);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER_VALUE);
  const [cityFilter, setCityFilter] = useState(ALL_FILTER_VALUE);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(properties.map((property) => property.city))).sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return properties.filter((property) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        property.name.toLowerCase().includes(normalizedSearch) ||
        property.customer.toLowerCase().includes(normalizedSearch) ||
        property.address.toLowerCase().includes(normalizedSearch) ||
        property.city.toLowerCase().includes(normalizedSearch) ||
        property.primarySystem.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || property.status === statusFilter;

      const matchesType =
        typeFilter === ALL_FILTER_VALUE || property.type === typeFilter;

      const matchesCity =
        cityFilter === ALL_FILTER_VALUE || property.city === cityFilter;

      return matchesSearch && matchesStatus && matchesType && matchesCity;
    });
  }, [cityFilter, properties, searchValue, statusFilter, typeFilter]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    statusFilter !== ALL_FILTER_VALUE ||
    typeFilter !== ALL_FILTER_VALUE ||
    cityFilter !== ALL_FILTER_VALUE;

  function handleClearFilters() {
    setSearchValue("");
    setStatusFilter(ALL_FILTER_VALUE);
    setTypeFilter(ALL_FILTER_VALUE);
    setCityFilter(ALL_FILTER_VALUE);
  }

  function handleRowClick(property: Property) {
    router.push(`/properties/${property.id}`);
  }

  if (!hydrated || loading) {
    return (
      <div className="space-y-4">
        <PropertyToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          cityFilter={cityFilter}
          onCityChange={setCityFilter}
          cityOptions={cityOptions}
          onClearFilters={handleClearFilters}
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

  if (error) {
    return (
      <div className="space-y-4">
        <PropertyToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          cityFilter={cityFilter}
          onCityChange={setCityFilter}
          cityOptions={cityOptions}
          onClearFilters={handleClearFilters}
        />

        <ErrorState
          title="Unable to load properties"
          description={error}
          action={
            <Button variant="outline" onClick={() => void refreshProperties()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (filteredProperties.length === 0) {
    return (
      <div className="space-y-4">
        <PropertyToolbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          cityFilter={cityFilter}
          onCityChange={setCityFilter}
          cityOptions={cityOptions}
          onClearFilters={handleClearFilters}
        />

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No properties found</h3>

          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            We couldn&apos;t find any properties matching your current search and
            filter settings.
          </p>

          {hasActiveFilters ? (
            <Button
              variant="outline"
              className="mt-6"
              onClick={handleClearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PropertyToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        cityFilter={cityFilter}
        onCityChange={setCityFilter}
        cityOptions={cityOptions}
        onClearFilters={handleClearFilters}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {filteredProperties.length}{" "}
          {filteredProperties.length === 1 ? "property" : "properties"}
        </p>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={propertyColumns}
        data={filteredProperties}
        onRowClick={handleRowClick}
      />
    </div>
  );
}