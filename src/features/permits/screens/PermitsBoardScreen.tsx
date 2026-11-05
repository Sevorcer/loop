"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
} from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { cn } from "@/lib/utils";
type PermitStatus =
  | "applied"
  | "intake_scheduled"
  | "corrections_needed"
  | "resubmitted"
  | "waiting_on_city"
  | "issued";

/** Office+ roles that can write permits (mirrors service-layer canEditPermits). */
function canEditPermits(role: string): boolean {
  return role === "owner" || role === "manager" || role === "office";
}

import {
  PermitEditPanel,
  type PermitEditData,
} from "../components/PermitEditPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Permit {
  id: string;
  jobId: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: PermitStatus;
  appliedAt: string | null;
  intakeAppointmentAt: string | null;
  issuedAt: string | null;
  correctionsNotes: string | null;
  notes: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jobCustomerName: string | null;
  jobPropertyName: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Column order (left-to-right on the board). Issued is handled separately. */
const COLUMN_ORDER: PermitStatus[] = [
  "corrections_needed",
  "waiting_on_city",
  "intake_scheduled",
  "applied",
  "resubmitted",
];

const STATUS_LABELS: Record<PermitStatus, string> = {
  applied: "Applied",
  intake_scheduled: "Intake Scheduled",
  corrections_needed: "Corrections Needed",
  resubmitted: "Resubmitted",
  waiting_on_city: "Waiting on City",
  issued: "Issued",
};

const STATUS_INTENT: Record<
  PermitStatus,
  "info" | "warning" | "success" | "danger" | "neutral"
> = {
  applied: "info",
  intake_scheduled: "info",
  corrections_needed: "warning",
  resubmitted: "info",
  waiting_on_city: "warning",
  issued: "success",
};

const ALL_STATUSES: PermitStatus[] = [
  "applied",
  "intake_scheduled",
  "corrections_needed",
  "resubmitted",
  "waiting_on_city",
  "issued",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Days since applied (or created if no appliedAt). */
function daysSince(p: Permit): number {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(p.appliedAt || p.createdAt).getTime()) / 86400000,
    ),
  );
}

/** Human-readable label for permits that may have blank jurisdiction/type. */
function permitLabel(p: Permit): string {
  const j = (p.jurisdiction ?? "").trim();
  const t = (p.permitType ?? "").trim();
  if (j && t) return `${j} — ${t}`;
  if (j) return j;
  if (t) return t;
  if (p.permitNumber) return `#${p.permitNumber}`;
  return p.jobCustomerName || p.jobPropertyName || "Permit";
}

/** Group permits by status and sort by age (oldest first). */
function groupByStatus(
  permits: Permit[],
): Record<PermitStatus, Permit[]> {
  const groups = {} as Record<PermitStatus, Permit[]>;
  for (const s of ALL_STATUSES) groups[s] = [];
  for (const p of permits) {
    if (groups[p.status]) groups[p.status].push(p);
  }
  for (const s of ALL_STATUSES) {
    groups[s].sort((a, b) => daysSince(b) - daysSince(a));
  }
  return groups;
}

/** Filter permits by search query and status filters. */
function filterPermits(
  permits: Permit[],
  search: string,
  statusFilters: Set<PermitStatus>,
): Permit[] {
  let result = permits;

  if (statusFilters.size > 0) {
    result = result.filter((p) => statusFilters.has(p.status));
  }

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    result = result.filter((p) => {
      const fields = [
        p.jurisdiction,
        p.permitType,
        p.permitNumber,
        p.jobCustomerName,
        p.jobPropertyName,
      ];
      return fields.some((f) => f && f.toLowerCase().includes(q));
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDropdown({
  current,
  onChange,
  disabled,
}: {
  current: PermitStatus;
  onChange: (status: PermitStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={current}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value as PermitStatus);
      }}
      onClick={(e) => e.stopPropagation()}
      disabled={disabled}
      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      aria-label="Change status"
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function AgeIndicator({ days }: { days: number }) {
  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        days > 7 ? "text-danger" : days > 3 ? "text-warning" : "text-muted",
      )}
      title={`${days} day${days !== 1 ? "s" : ""} since applied`}
    >
      {days}d
    </span>
  );
}

function StatusFilterChip({
  status,
  active,
  onToggle,
}: {
  status: PermitStatus;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted hover:border-accent/50 hover:text-primary",
      )}
    >
      {STATUS_LABELS[status]}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Permit Card
// ---------------------------------------------------------------------------

function PermitCard({
  permit,
  canEdit,
  onStatusChange,
  onEdit,
  onVoid,
}: {
  permit: Permit;
  canEdit: boolean;
  onStatusChange: (permitId: string, jobId: string, status: PermitStatus) => void;
  onEdit: (permit: Permit) => void;
  onVoid: (permitId: string, jobId: string) => void;
}) {
  const d = daysSince(permit);

  return (
    <div className="group rounded-lg border border-border p-3 transition-colors hover:bg-surface-elevated/50">
      {/* Top row: label + age */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={ROUTE_BUILDERS.JOB_DETAIL(permit.jobId)}
            className="text-sm font-medium text-primary hover:text-accent transition-colors truncate block"
            title="Go to job"
          >
            {permitLabel(permit)}
          </Link>
          {permit.permitNumber && (
            <p className="text-xs text-muted mt-0.5">#{permit.permitNumber}</p>
          )}
        </div>
        <AgeIndicator days={d} />
      </div>

      {/* Customer / property info */}
      {(permit.jobCustomerName || permit.jobPropertyName) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted truncate">
          {permit.jobCustomerName && (
            <span className="truncate">{permit.jobCustomerName}</span>
          )}
          {permit.jobCustomerName && permit.jobPropertyName && (
            <span className="text-border">|</span>
          )}
          {permit.jobPropertyName && (
            <span className="truncate">{permit.jobPropertyName}</span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {permit.notes && (
        <p className="mt-1.5 text-xs text-muted line-clamp-2">{permit.notes}</p>
      )}

      {/* Actions row */}
      {canEdit && (
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
          <StatusDropdown
            current={permit.status}
            onChange={(s) => onStatusChange(permit.id, permit.jobId, s)}
          />
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(permit)}
              className="rounded p-1 text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
              title="Edit permit"
              aria-label="Edit permit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <Link
              href={ROUTE_BUILDERS.JOB_DETAIL(permit.jobId)}
              className="rounded p-1 text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
              title="Open job"
              aria-label="Open job"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => onVoid(permit.id, permit.jobId)}
              className="rounded p-1 text-muted transition-colors hover:bg-surface-elevated hover:text-danger"
              title="Void permit"
              aria-label="Void permit"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Read-only: link to job */}
      {!canEdit && (
        <div className="mt-2 flex justify-end">
          <Link
            href={ROUTE_BUILDERS.JOB_DETAIL(permit.jobId)}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
          >
            View job
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function PermitsBoardScreen() {
  const { role } = useCurrentRole();
  const canEdit = role ? canEditPermits(role) : false;

  // Data
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<PermitStatus>>(
    new Set(),
  );

  // Edit panel
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);

  // Issued section
  const [issuedExpanded, setIssuedExpanded] = useState(false);

  // Fetch permits
  const fetchPermits = useCallback(async () => {
    try {
      const data = await requestJson<{ permits: Permit[] }>("/api/permits");
      setPermits(data.permits ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPermits();
  }, [fetchPermits]);

  // Filtered + grouped
  const filtered = useMemo(
    () => filterPermits(permits, search, statusFilters),
    [permits, search, statusFilters],
  );
  const grouped = useMemo(() => groupByStatus(filtered), [filtered]);

  // ------- Actions -------

  const handleStatusChange = useCallback(
    async (permitId: string, jobId: string, newStatus: PermitStatus) => {
      // Optimistic update
      setPermits((prev) =>
        prev.map((p) => (p.id === permitId ? { ...p, status: newStatus } : p)),
      );
      try {
        await requestJson(`/api/jobs/${jobId}/permits`, {
          method: "PATCH",
          body: { permitId, status: newStatus },
        });
      } catch {
        // Revert on failure
        void fetchPermits();
      }
    },
    [fetchPermits],
  );

  const handleSaveEdit = useCallback(
    async (
      permitId: string,
      jobId: string,
      fields: Record<string, unknown>,
    ) => {
      await requestJson(`/api/jobs/${jobId}/permits`, {
        method: "PATCH",
        body: { permitId, ...fields },
      });
      await fetchPermits();
    },
    [fetchPermits],
  );

  const handleVoid = useCallback(
    async (permitId: string, jobId: string) => {
      // Optimistic removal from the board
      setPermits((prev) => prev.filter((p) => p.id !== permitId));
      try {
        await requestJson(`/api/jobs/${jobId}/permits`, {
          method: "PATCH",
          body: { permitId, action: "void" },
        });
      } catch {
        void fetchPermits();
      }
    },
    [fetchPermits],
  );

  const toggleStatusFilter = useCallback((status: PermitStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilters(new Set());
  }, []);

  // ------- Rendering -------

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Permits Board" />
        <LoadingState message="Loading permits..." />
      </div>
    );
  }

  const totalOpen = permits.filter((p) => p.status !== "issued").length;
  const hasActiveFilters = search.trim() !== "" || statusFilters.size > 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Permits Board"
        description={`${totalOpen} open permit${totalOpen !== 1 ? "s" : ""}`}
      />

      {permits.length === 0 ? (
        <EmptyState
          title="No permits"
          description="Permits will appear here when created on jobs."
        />
      ) : (
        <>
          {/* ── Filter Bar ── */}
          <SurfaceCard>
            <div className="p-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by customer, permit #, or jurisdiction..."
                  className="w-full rounded-lg border border-border bg-surface-elevated py-2 pl-10 pr-10 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-primary"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted mr-1">Status:</span>
                {ALL_STATUSES.map((s) => (
                  <StatusFilterChip
                    key={s}
                    status={s}
                    active={statusFilters.has(s)}
                    onToggle={() => toggleStatusFilter(s)}
                  />
                ))}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-2 text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Filter results count */}
              {hasActiveFilters && (
                <p className="text-xs text-muted">
                  Showing {filtered.length} of {permits.length} permits
                </p>
              )}
            </div>
          </SurfaceCard>

          {/* ── Kanban Columns ── */}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {COLUMN_ORDER.map((status) => {
              const group = grouped[status];
              if (!group.length) return null;

              return (
                <SurfaceCard key={status}>
                  <div className="p-4">
                    {/* Column header */}
                    <div className="flex items-center justify-between mb-3">
                      <StatusBadge variant={STATUS_INTENT[status]}>
                        {STATUS_LABELS[status]}
                      </StatusBadge>
                      <span className="text-xs text-muted">{group.length}</span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {group.map((p) => (
                        <PermitCard
                          key={p.id}
                          permit={p}
                          canEdit={canEdit}
                          onStatusChange={handleStatusChange}
                          onEdit={setEditingPermit}
                          onVoid={handleVoid}
                        />
                      ))}
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          {/* ── Issued Section ── */}
          {grouped.issued.length > 0 && (
            <SurfaceCard>
              <div className="p-4">
                <button
                  onClick={() => setIssuedExpanded((prev) => !prev)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  {issuedExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted" />
                  )}
                  <StatusBadge variant="success">Issued</StatusBadge>
                  <span className="text-xs text-muted">
                    {grouped.issued.length} issued
                  </span>
                </button>

                {issuedExpanded && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped.issued.map((p) => (
                      <PermitCard
                        key={p.id}
                        permit={p}
                        canEdit={canEdit}
                        onStatusChange={handleStatusChange}
                        onEdit={setEditingPermit}
                        onVoid={handleVoid}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SurfaceCard>
          )}
        </>
      )}

      {/* ── Edit Panel ── */}
      {editingPermit && (
        <PermitEditPanel
          key={editingPermit.id}
          permit={editingPermit as PermitEditData}
          open={!!editingPermit}
          onClose={() => setEditingPermit(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
