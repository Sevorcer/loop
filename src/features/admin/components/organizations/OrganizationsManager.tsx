"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { AccessDenied, LoadingState, SectionCard } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import type { AdminApiError } from "@/lib/adminApiError";
import { usePermission } from "@/hooks/usePermission";
import { useCurrentRole } from "@/features/auth";
import {
  AdminFieldError,
  AdminFieldWrapper,
  AdminFormActions,
  AdminFormError,
} from "../form";

interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  pageSize: number;
}

interface ParsedApiError {
  message: string;
  fieldErrors?: Record<string, string[]>;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

async function parseApiError(response: Response): Promise<ParsedApiError> {
  try {
    const payload = (await response.json()) as Partial<AdminApiError>;
    if (typeof payload.message === "string") {
      return {
        message: payload.message,
        fieldErrors: payload.fieldErrors,
      };
    }
  } catch {
    // fall through
  }

  return {
    message: `Request failed with status ${response.status}.`,
  };
}

export function OrganizationsManager() {
  const { role } = useCurrentRole();
  const selectPermission = usePermission("organizations", "select");
  const insertPermission = usePermission("organizations", "insert");
  const updatePermission = usePermission("organizations", "update");
  const deletePermission = usePermission("organizations", "delete");

  const isPermissionLoading =
    selectPermission.loading ||
    insertPermission.loading ||
    updatePermission.loading ||
    deletePermission.loading;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string[]>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string[]>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const hasOrganizations = organizations.length > 0;

  const getHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = {};
    if (role) {
      headers["x-loop-role"] = role;
    }
    return headers;
  }, [role]);

  const loadOrganizations = useCallback(async () => {
    if (!selectPermission.allowed) return;

    setIsLoading(true);
    setListError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim().length > 0) {
      params.set("search", search.trim());
    }
    if (includeDeleted) {
      params.set("includeDeleted", "true");
    }

    try {
      const response = await fetch(`/api/organizations?${params.toString()}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        setListError(error.message);
        setOrganizations([]);
        setTotal(0);
        return;
      }

      const payload = (await response.json()) as OrganizationsResponse;
      setOrganizations(payload.organizations);
      setTotal(payload.total);
    } catch {
      setListError("Unable to load organizations right now.");
      setOrganizations([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, includeDeleted, page, pageSize, search, selectPermission.allowed]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function resetCreateState() {
    setCreateName("");
    setCreateFieldErrors({});
    setCreateError(null);
  }

  function beginEdit(record: Organization) {
    setEditingId(record.id);
    setEditName(record.name);
    setEditFieldErrors({});
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditFieldErrors({});
    setEditError(null);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!insertPermission.allowed) return;

    setIsCreating(true);
    setCreateFieldErrors({});
    setCreateError(null);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getHeaders(),
        },
        body: JSON.stringify({ name: createName }),
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        setCreateError(error.message);
        setCreateFieldErrors(error.fieldErrors ?? {});
        return;
      }

      resetCreateState();
      if (page !== 1) {
        setPage(1);
      } else {
        await loadOrganizations();
      }
    } catch {
      setCreateError("Failed to create organization.");
    } finally {
      setIsCreating(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !updatePermission.allowed) return;

    setIsUpdating(true);
    setEditFieldErrors({});
    setEditError(null);

    try {
      const response = await fetch(`/api/organizations/${editingId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...getHeaders(),
        },
        body: JSON.stringify({ name: editName }),
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        setEditError(error.message);
        setEditFieldErrors(error.fieldErrors ?? {});
        return;
      }

      cancelEdit();
      await loadOrganizations();
    } catch {
      setEditError("Failed to update organization.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function deleteOrganization(id: string) {
    if (!deletePermission.allowed || deletingId) return;
    const confirmed = window.confirm(
      "Delete this organization? This is a soft delete and can affect linked records.",
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        setListError(error.message);
        return;
      }

      await loadOrganizations();
    } catch {
      setListError("Failed to delete organization.");
    } finally {
      setDeletingId(null);
    }
  }

  if (isPermissionLoading) {
    return <LoadingState message="Resolving organization permissions..." />;
  }

  if (!selectPermission.allowed) {
    return (
      <AccessDenied
        description="You do not have permission to view organizations."
        showHomeLink={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Search and filters"
        description="Search organizations by name and control page size."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void loadOrganizations()}>
            Refresh
          </Button>
        }
      >
        <form
          className="grid gap-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput);
          }}
        >
          <div className="md:col-span-2">
            <AdminFieldWrapper label="Name search" htmlFor="organization-search">
              <input
                id="organization-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search organizations"
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </AdminFieldWrapper>
          </div>

          <AdminFieldWrapper label="Page size" htmlFor="organization-page-size">
            <select
              id="organization-page-size"
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              }}
              className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </AdminFieldWrapper>

          <label className="mt-7 inline-flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => {
                setPage(1);
                setIncludeDeleted(event.target.checked);
              }}
            />
            Include soft-deleted
          </label>

          <div className="md:col-span-4 flex justify-end">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
          </div>
        </form>
      </SectionCard>

      {insertPermission.allowed ? (
        <SectionCard title="Create organization" description="Add a new platform organization.">
          <form className="space-y-4" onSubmit={submitCreate}>
            <AdminFormError error={createError} />
            <AdminFieldWrapper label="Organization name" htmlFor="organization-create-name" required>
              <input
                id="organization-create-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Example: Northwest HVAC Group"
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
              <AdminFieldError fieldId="organization-create-name" errors={createFieldErrors.name} />
            </AdminFieldWrapper>
            <AdminFormActions
              submitLabel="Create organization"
              loadingLabel="Creating..."
              isLoading={isCreating}
              disabled={createName.trim().length === 0}
            />
          </form>
        </SectionCard>
      ) : null}

      {editingId ? (
        <SectionCard title="Edit organization" description="Update the selected organization name.">
          <form className="space-y-4" onSubmit={submitEdit}>
            <AdminFormError error={editError} />
            <AdminFieldWrapper label="Organization name" htmlFor="organization-edit-name" required>
              <input
                id="organization-edit-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
              <AdminFieldError fieldId="organization-edit-name" errors={editFieldErrors.name} />
            </AdminFieldWrapper>
            <AdminFormActions
              submitLabel="Save changes"
              loadingLabel="Saving..."
              isLoading={isUpdating}
              disabled={editName.trim().length === 0}
              cancelAction={
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
              }
            />
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Organizations"
        description="Use edit and soft-delete actions to maintain organization records."
      >
        <AdminFormError error={listError} />

        <div className="overflow-x-auto rounded-lg border border-default">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={4}>
                    Loading organizations...
                  </td>
                </tr>
              ) : null}

              {!isLoading && !hasOrganizations ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={4}>
                    No organizations found.
                  </td>
                </tr>
              ) : null}

              {!isLoading &&
                organizations.map((organization) => (
                  <tr key={organization.id} className="border-t border-default">
                    <td className="px-3 py-2 text-primary">{organization.name}</td>
                    <td className="px-3 py-2">
                      {organization.deletedAt ? (
                        <span className="rounded-full border border-default px-2 py-0.5 text-xs text-muted">
                          Deleted
                        </span>
                      ) : (
                        <span className="rounded-full border border-default px-2 py-0.5 text-xs text-primary">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{formatTimestamp(organization.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {updatePermission.allowed ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={Boolean(organization.deletedAt)}
                            onClick={() => beginEdit(organization)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {deletePermission.allowed ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={Boolean(organization.deletedAt) || deletingId === organization.id}
                            onClick={() => void deleteOrganization(organization.id)}
                          >
                            {deletingId === organization.id ? "Deleting..." : "Delete"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {total === 0 ? "0 results" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
