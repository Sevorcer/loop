"use client";

/**
 * FeedbackTriageScreen — Sprint 7 Mini-Epic
 *
 * Manager/owner-only triage list for feedback_reports.
 * Supports filtering by status, severity, date range.
 * Allows inline status + triage notes update.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoutePermissionGuard } from "@/components/atlas/RoutePermissionGuard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { EmptyState } from "@/components/atlas/EmptyState";
import { LoadingState } from "@/components/atlas/LoadingState";
import { ROUTE_BUILDERS } from "@/lib/routes"; import { useCurrentRole } from "@/features/auth";
import type {
  FeedbackReport,
  FeedbackSeverity,
  FeedbackStatus,
} from "@/features/feedback/types/feedbackReport";
import {
  FEEDBACK_SEVERITY_VALUES,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUS_VALUES,
  FEEDBACK_STATUS_LABELS,
} from "@/features/feedback/types/feedbackReport";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBadgeVariant(severity: FeedbackSeverity) {
  switch (severity) {
    case "P0":
      return "danger" as const;
    case "P1":
      return "warning" as const;
    case "P2":
      return "info" as const;
    case "P3":
      return "neutral" as const;
  }
}

function statusBadgeVariant(status: FeedbackStatus) {
  switch (status) {
    case "new":
      return "info" as const;
    case "triaged":
      return "warning" as const;
    case "in_progress":
      return "warning" as const;
    case "resolved":
      return "success" as const;
    case "wontfix":
      return "neutral" as const;
  }
}

const SUCCESS_MESSAGE_DURATION_MS = 3000;

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Row detail / triage drawer ───────────────────────────────────────────────

interface TriageDrawerProps {
  report: FeedbackReport;
  onUpdated: (updated: FeedbackReport) => void;
  onClose: () => void;
}

function TriageDrawer({ report, onUpdated, onClose }: TriageDrawerProps) {
  const [status, setStatus] = useState<FeedbackStatus>(report.status);
  const [triageNotes, setTriageNotes] = useState(report.triageNotes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null); // Validate triage notes are provided
    if (!triageNotes.trim()) { setError("Please add triage notes before saving."); return; } setIsSubmitting(true);

    try {
      const res = await fetch(`/api/feedback/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, triageNotes: triageNotes.trim() || null }),
      });

      const data = await res.json().catch(() => ({})) as { report?: FeedbackReport; message?: string };

      if (res.ok && data.report) {
        onUpdated(data.report);
        onClose();
        return;
      }

      setError(data.message ?? "Failed to save triage update.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-default bg-surface-elevated p-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Status */}
        <div className="space-y-1.5">
          <label htmlFor={`triage-status-${report.id}`} className="block text-xs font-medium text-primary">
            Status
          </label>
          <select
            id={`triage-status-${report.id}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
            className="w-full rounded-xl border border-default bg-surface px-3 py-2 text-sm text-primary focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            {FEEDBACK_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Triage notes */}
      <div className="space-y-1.5">
        <label htmlFor={`triage-notes-${report.id}`} className="block text-xs font-medium text-primary">
          Triage Notes *
        </label>
        <textarea
          id={`triage-notes-${report.id}`} required
          value={triageNotes}
          onChange={(e) => setTriageNotes(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Add triage context, root cause, or action taken…"
          className="w-full resize-none rounded-xl border border-default bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      {error ? (
        <p role="alert" className="text-xs text-red-400">{error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function FeedbackTriageScreen() {   const { role } = useCurrentRole();
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<FeedbackSeverity | "">("");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "">("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Expanded row for inline triage
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // F16: bulk triage selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterStatus) params.set("status", filterStatus);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/feedback?${params.toString()}`);
      const data = await res.json().catch(() => ({})) as { reports?: FeedbackReport[]; message?: string };

      if (res.ok && data.reports) {
        setReports(data.reports);
        setSelectedIds(new Set());
      } else {
        setLoadError(data.message ?? "Failed to load feedback reports.");
      }
    } catch {
      setLoadError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [filterSeverity, filterStatus, filterFrom, filterTo]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setIsLoading(true);
      setLoadError(null);
      await fetchReports();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchReports]);

  function handleRetry() {
    setLoadError(null);
    setIsLoading(true);
    fetchReports();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === reports.length ? new Set() : new Set(reports.map((r) => r.id)),
    );
  }

  function flashSuccess(message: string) {
    setSuccessMessage(message);
    if (successTimerRef.current !== null) {
      clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_DURATION_MS);
  }

  async function handleBulkUpdate(status: FeedbackStatus) {
    if (selectedIds.size === 0 || isBulkUpdating) return;
    setBulkError(null);
    setIsBulkUpdating(true);
    try {
      const res = await fetch("/api/feedback/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      const data = await res.json().catch(() => ({})) as {
        reports?: FeedbackReport[];
        updated?: number;
        message?: string;
      };
      if (res.ok && data.reports) {
        const updatedById = new Map(data.reports.map((r) => [r.id, r]));
        setReports((prev) => prev.map((r) => updatedById.get(r.id) ?? r));
        flashSuccess(`${data.updated ?? data.reports.length} report(s) marked as ${FEEDBACK_STATUS_LABELS[status]}.`);
        setSelectedIds(new Set());
      } else {
        setBulkError(data.message ?? "Bulk update failed.");
      }
    } catch {
      setBulkError("Network error. Please try again.");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  function handleUpdated(updated: FeedbackReport) {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setExpandedId(null);
    flashSuccess("Status updated successfully.");
  }

  return (
    <RoutePermissionGuard
      table="feedback_reports"
      action="select"
      deniedDescription="You don't have permission to view feedback reports."
    >
      <div className="space-y-6">
        {/* Success flash */}
        {successMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400"
          >
            {successMessage}
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-default bg-surface p-4">
          <div className="space-y-1">
            <label htmlFor="filter-severity" className="block text-xs font-medium text-muted">
              Severity
            </label>
            <select
              id="filter-severity"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as FeedbackSeverity | "")}
              className="h-9 rounded-xl border border-default bg-surface-elevated px-3 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">All severities</option>
              {FEEDBACK_SEVERITY_VALUES.map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-status" className="block text-xs font-medium text-muted">
              Status
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FeedbackStatus | "")}
              className="h-9 rounded-xl border border-default bg-surface-elevated px-3 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">All statuses</option>
              {FEEDBACK_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-from" className="block text-xs font-medium text-muted">
              From
            </label>
            <input
              id="filter-from"
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="h-9 rounded-xl border border-default bg-surface-elevated px-3 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-to" className="block text-xs font-medium text-muted">
              To
            </label>
            <input
              id="filter-to"
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="h-9 rounded-xl border border-default bg-surface-elevated px-3 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterSeverity("");
              setFilterStatus("");
              setFilterFrom("");
              setFilterTo("");
            }}
            className="self-end"
          >
            Clear
          </Button>
        </div>

        {/* F16: bulk triage bar */}
        {selectedIds.size > 0 && role !== "tech" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
            <p className="text-sm font-medium text-blue-300">
              {selectedIds.size} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => handleBulkUpdate("triaged")}
              >
                {isBulkUpdating ? "Updating…" : "Mark triaged"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => handleBulkUpdate("resolved")}
              >
                Mark resolved
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => handleBulkUpdate("wontfix")}
                className="text-slate-300 hover:text-white"
              >
                Dismiss
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-400 hover:text-white"
              >
                Clear
              </Button>
            </div>
            {bulkError ? (
              <p role="alert" className="w-full text-xs text-red-400">{bulkError}</p>
            ) : null}
          </div>
        ) : null}

        {/* Results */}
        {isLoading ? (
          <LoadingState />
        ) : loadError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <p>{loadError}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="mt-3 text-red-300 hover:text-red-200"
            >
              Retry
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            title="No feedback reports"
            description="No reports match the current filters."
          />
        ) : (
          <div className="rounded-xl border border-default bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Feedback reports">
                <thead>
                  <tr className="border-b border-default bg-surface-elevated text-left text-xs text-muted">
                    <th scope="col" className="px-4 py-3 font-medium">
                      <input
                        type="checkbox"
                        aria-label="Select all feedback reports"
                        checked={reports.length > 0 && selectedIds.size === reports.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 accent-blue-500"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">Severity</th>
                    <th scope="col" className="px-4 py-3 font-medium">Intended action</th>
                    <th scope="col" className="px-4 py-3 font-medium">Role</th>
                    <th scope="col" className="px-4 py-3 font-medium">Route</th>
                    <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Context</th>
                    <th scope="col" className="px-4 py-3 font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <>
                      <tr
                        key={report.id}
                        className="border-b border-default last:border-0 hover:bg-surface-elevated/50 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedId((prev) => (prev === report.id ? null : report.id))
                        }
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select feedback report: ${report.intendedAction}`}
                            checked={selectedIds.has(report.id)}
                            onChange={() => toggleSelected(report.id)}
                            className="h-4 w-4 accent-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={severityBadgeVariant(report.severity)}>
                            {report.severity}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="truncate text-primary" title={report.intendedAction}>
                            {report.intendedAction}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted">{report.createdByRole}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-muted">{report.routePath}</code>
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {formatDate(report.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={statusBadgeVariant(report.status)}>
                            {FEEDBACK_STATUS_LABELS[report.status]}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {report.contextJobId ? (
                              <Link
                                href={ROUTE_BUILDERS.JOB_DETAIL(report.contextJobId)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                Job <ExternalLink size={10} />
                              </Link>
                            ) : null}
                            {report.contextCustomerId ? (
                              <Link
                                href={ROUTE_BUILDERS.CUSTOMER_DETAIL(report.contextCustomerId)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                Customer <ExternalLink size={10} />
                              </Link>
                            ) : null}
                            {report.contextPropertyId ? (
                              <Link
                                href={ROUTE_BUILDERS.PROPERTY_DETAIL(report.contextPropertyId)}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                Property <ExternalLink size={10} />
                              </Link>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {expandedId === report.id ? (
                            <ChevronDown size={14} className="text-muted" />
                          ) : (
                            <ChevronRight size={14} className="text-muted" />
                          )}
                        </td>
                      </tr>

                      {expandedId === report.id ? (
                        <tr key={`${report.id}-detail`}>
                          <td colSpan={9} className="px-4 pb-4 pt-1 bg-surface-elevated/30">
                            <div className="mb-3 space-y-2 text-sm">
                              <div>
                                <p className="text-xs font-medium text-muted mb-0.5">What happened</p>
                                <p className="text-primary">{report.actualResult}</p>
                              </div>
                              {report.triageNotes ? (
                                <div>
                                  <p className="text-xs font-medium text-muted mb-0.5">Triage notes</p>
                                  <p className="text-primary">{report.triageNotes}</p>
                                </div>
                              ) : null}
                              {report.screenshotUrl ? (
                                <div>
                                  <p className="text-xs font-medium text-muted mb-0.5">Screenshot</p>
                                  <a
                                    href={report.screenshotUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    View screenshot <ExternalLink size={10} />
                                  </a>
                                </div>
                              ) : null}
                            </div>
                            <TriageDrawer
                              report={report}
                              onUpdated={handleUpdated}
                              onClose={() => setExpandedId(null)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </RoutePermissionGuard>
  );
}
