"use client";

import { useEffect, useState } from "react";
import { Building, Pencil, Plus, PowerOff, Search } from "lucide-react";

import { EmptyState } from "@/components/atlas/EmptyState";
import { PageHeader } from "@/components/atlas/PageHeader";
import { Button } from "@/components/ui/button";

import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import {
  EditOrganizationDialog,
  type OrganizationForEdit,
} from "./EditOrganizationDialog";
import {
  DeactivateOrganizationDialog,
  type OrganizationForDeactivate,
} from "./DeactivateOrganizationDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

interface ListResult {
  organizations: Organization[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrganizationsClient() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrganizationForEdit | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<OrganizationForDeactivate | null>(null);

  // Debounce search input (setState inside setTimeout callback — not synchronous in effect body)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch organizations (setState inside setTimeout callback to satisfy react-hooks/set-state-in-effect)
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      setIsLoading(true);
      setLoadError(null);

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      try {
        const res = await fetch(`/api/organizations?${params.toString()}`);
        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setLoadError(body.message ?? "Failed to load organizations.");
          return;
        }

        const data: ListResult = await res.json();
        if (!cancelled) {
          setOrganizations(data.organizations);
          setTotal(data.total);
        }
      } catch {
        if (!cancelled) setLoadError("Network error. Unable to load organizations.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, debouncedSearch, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleCreated() {
    setCreateOpen(false);
    setPage(1);
    refresh();
  }

  function handleUpdated() {
    setEditTarget(null);
    refresh();
  }

  function handleDeactivated() {
    setDeactivateTarget(null);
    refresh();
  }

  const isEmpty = !isLoading && !loadError && organizations.length === 0;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Organizations"
          description="Create and manage platform organizations. Create, edit, and deactivate operations are restricted to platform administrators."
          actions={
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="gap-2"
            >
              <Plus size={16} aria-hidden="true" />
              New Organization
            </Button>
          }
        />

        {/* Search */}
        <div className="relative max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations…"
            className="w-full rounded-atlas-md border border-default bg-surface-elevated/50 py-2 pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Error state */}
        {loadError ? (
          <div
            role="alert"
            className="status-danger rounded-atlas-md px-4 py-3 text-sm"
          >
            {loadError}
          </div>
        ) : null}

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="space-y-2" aria-label="Loading organizations…" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-atlas-md bg-surface-elevated/60"
              />
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {isEmpty ? (
          <EmptyState
            icon={<Building size={20} />}
            title={debouncedSearch ? "No organizations found" : "No organizations yet"}
            description={
              debouncedSearch
                ? `No organizations match "${debouncedSearch}". Try a different search.`
                : "Create your first organization to get started."
            }
          />
        ) : null}

        {/* Table */}
        {!isLoading && !loadError && organizations.length > 0 ? (
          <div className="overflow-hidden rounded-atlas-xl border border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default bg-surface/60">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-muted"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-3 text-left font-medium text-muted sm:table-cell"
                  >
                    Created
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/60">
                {organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="bg-surface transition-colors hover:bg-surface-elevated/50"
                  >
                    <td className="px-4 py-3 font-medium text-primary">
                      {org.name}
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {formatDate(org.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditTarget({ id: org.id, name: org.name })
                          }
                          aria-label={`Edit ${org.name}`}
                          className="flex items-center gap-1.5 rounded-atlas-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)]"
                        >
                          <Pencil size={12} aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeactivateTarget({ id: org.id, name: org.name })
                          }
                          aria-label={`Deactivate ${org.name}`}
                          className="flex items-center gap-1.5 rounded-atlas-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
                        >
                          <PowerOff size={12} aria-hidden="true" />
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Pagination */}
        {!isLoading && !loadError && totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {total === 1 ? "1 organization" : `${total} organizations`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-atlas-md px-3 py-1.5 transition-colors hover:bg-surface-elevated hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                Previous
              </button>
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-atlas-md px-3 py-1.5 transition-colors hover:bg-surface-elevated hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modals — rendered conditionally so they mount fresh each time (no reset effects needed) */}
      {createOpen ? (
        <CreateOrganizationDialog
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}

      {editTarget ? (
        <EditOrganizationDialog
          key={editTarget.id}
          organization={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={handleUpdated}
        />
      ) : null}

      {deactivateTarget ? (
        <DeactivateOrganizationDialog
          key={deactivateTarget.id}
          organization={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDeactivated={handleDeactivated}
        />
      ) : null}
    </>
  );
}

