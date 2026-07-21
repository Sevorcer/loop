"use client";
import { useEffect, useMemo, useState } from "react";
import { Building, Plus, RefreshCw, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { EmptyState } from "@/components/atlas/EmptyState";

/**
 * NOTE:
 * - This is a drop-in client-side scaffold that wires the screen to /api/organizations.
 * - Keep endpoint shape flexible by normalizing common payload patterns.
 * - If your API has stricter types, replace `Organization` and normalization accordingly.
 */

type Organization = {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type LoadState = "idle" | "loading" | "success" | "error";

function normalizeOrganizationsPayload(payload: any): Organization[] {
  if (Array.isArray(payload)) return payload as Organization[];
  if (Array.isArray(payload?.organizations)) return payload.organizations as Organization[];
  if (Array.isArray(payload?.data)) return payload.data as Organization[];
  if (Array.isArray(payload?.items)) return payload.items as Organization[];
  return [];
}

function getStatusLabel(org: Organization): string {
  if (typeof org.status === "string" && org.status.trim().length > 0) return org.status;
  if (org.isActive === true) return "active";
  if (org.isActive === false) return "inactive";
  return "unknown";
}

export function OrganizationsScreen() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const hasData = organizations.length > 0;

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations]);

  async function loadOrganizations() {
    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/organizations", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("You are not signed in. Please sign in and try again.");
        }
        if (response.status === 403) {
          throw new Error("You do not have permission to view organizations.");
        }

        let details = "";
        try {
          const errBody = await response.json();
          details = errBody?.message ?? errBody?.error ?? "";
        } catch {
          // ignore json parse errors
        }

        throw new Error(details || `Failed to load organizations (HTTP ${response.status}).`);
      }

      const json = await response.json();
      const rows = normalizeOrganizationsPayload(json);
      setOrganizations(rows);
      setState("success");
    } catch (err: any) {
      setState("error");
      setErrorMessage(err?.message || "An unexpected error occurred while loading organizations.");
    }
  }

  useEffect(() => {
    void loadOrganizations();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage platform organizations. Create and edit operations are restricted to platform administrators."
      />

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">
          {state === "success" ? `${organizations.length} organization(s)` : " "}
        </div>

        {/* Hook this button up to your modal/route when ready */}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          onClick={() => {
            // TODO: replace with openCreateOrganizationModal() or router.push('/admin/organizations/new')
            window.alert("Create Organization flow not yet connected.");
          }}
        >
          <Plus size={16} />
          Create Organization
        </button>
      </div>

      {state === "loading" && (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-sm text-slate-300">
          <div className="inline-flex items-center gap-2">
            <RefreshCw className="animate-spin" size={16} />
            Loading organizations...
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-200">
          <div className="mb-2 inline-flex items-center gap-2 font-medium">
            <AlertTriangle size={16} />
            Could not load organizations
          </div>
          <p className="mb-4 text-red-200/90">{errorMessage}</p>
          <button
            type="button"
            className="rounded-md border border-red-800 px-3 py-2 text-sm hover:bg-red-900/30"
            onClick={() => void loadOrganizations()}
          >
            Retry
          </button>
        </div>
      )}

      {state === "success" && !hasData && (
        <EmptyState
          icon={<Building size={20} />}
          title="No organizations yet"
          description="Create your first organization to get started."
        />
      )}

      {state === "success" && hasData && (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-925">
              {sortedOrganizations.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-3 text-sm text-slate-100">{org.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{org.code ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{getStatusLabel(org)}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 px-2.5 py-1.5 text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          // TODO: replace with edit flow (modal/route)
                          window.alert(`Edit organization: ${org.name}`);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-700 px-2.5 py-1.5 text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          // TODO: replace with deactivate/delete flow
                          window.alert(`Deactivate organization: ${org.name}`);
                        }}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}