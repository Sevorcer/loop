"use client";

import { useMemo, useState, type ReactNode } from "react";

import { ErrorState, KPICard, LoadingState, SectionCard } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { todayInCompanyTimeZone } from "@/lib/timezone";

import { useProductionReport } from "../state/useProductionReport";
import { canSeeJobRevenue } from "../utils/revenueAccess";
import {
  REVENUE_SPLIT_NOTE,
  SCHEDULED_HOURS_LABEL,
  SCHEDULED_HOURS_NOTE,
  formatRevenueCents,
  formatScheduledHours,
  redactProductionReport,
  resolvePresetRange,
  type ProductionBucket,
  type ProductionPersonBucket,
  type ProductionReport,
  type RangePreset,
} from "../utils/productionReport";

const PRESETS: Array<{ id: Exclude<RangePreset, "custom">; label: string }> = [
  { id: "this-week", label: "This week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
];

export function ProductionReportSection() {
  const { role } = useCurrentRole();
  const today = todayInCompanyTimeZone();
  const initial = resolvePresetRange("this-month", today);
  const [preset, setPreset] = useState<RangePreset>("this-month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { report, loading, error } = useProductionReport(from, to);
  const showRevenue = Boolean(role) && canSeeJobRevenue(role) && report?.canSeeRevenue === true;
  const visible = useMemo(
    () => (report && !showRevenue ? redactProductionReport(report) : report),
    [report, showRevenue],
  );

  function applyPreset(next: Exclude<RangePreset, "custom">) {
    const range = resolvePresetRange(next, todayInCompanyTimeZone());
    setPreset(next);
    setFrom(range.from);
    setTo(range.to);
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ from, to, format: "csv" });
      const response = await fetch(`/api/reports/production?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || "The spreadsheet could not be downloaded.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `production-${from}-to-${to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : "The spreadsheet could not be downloaded.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <SectionCard
      title="Production"
      actions={
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting || loading || !visible}
          className="min-h-10 rounded-full border border-default px-3 text-sm text-foreground hover:bg-surface-elevated disabled:opacity-50"
        >
          {exporting ? "Preparing…" : "Download CSV"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Report dates">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={preset === item.id}
              onClick={() => applyPreset(item.id)}
              className={`min-h-10 rounded-full border px-3 text-sm ${
                preset === item.id
                  ? "border-default bg-surface-elevated text-foreground"
                  : "border-default text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={preset === "custom"}
            onClick={() => setPreset("custom")}
            className={`min-h-10 rounded-full border px-3 text-sm ${
              preset === "custom"
                ? "border-default bg-surface-elevated text-foreground"
                : "border-default text-muted"
            }`}
          >
            Custom
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-muted">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPreset("custom");
                if (event.target.value) setFrom(event.target.value);
              }}
              className="block min-h-10 rounded-xl border border-default bg-transparent px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPreset("custom");
                if (event.target.value) setTo(event.target.value);
              }}
              className="block min-h-10 rounded-xl border border-default bg-transparent px-3 text-sm text-foreground"
            />
          </label>
        </div>

        <p className="text-sm leading-relaxed text-muted">{SCHEDULED_HOURS_NOTE}</p>
        {showRevenue ? (
          <p className="text-sm leading-relaxed text-muted">{REVENUE_SPLIT_NOTE}</p>
        ) : null}
        {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}

        {loading ? (
          <LoadingState message="Loading production..." />
        ) : error || !visible ? (
          <ErrorState title="Unable to load production" description={error ?? "Try another date range."} />
        ) : (
          <ProductionReportView report={visible} showRevenue={showRevenue} />
        )}
      </div>
    </SectionCard>
  );
}

export function ProductionReportView({
  report,
  showRevenue,
}: {
  report: ProductionReport;
  showRevenue: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard title="Jobs" value={report.totals.jobs} />
        {showRevenue ? (
          <KPICard title="Revenue" value={formatRevenueCents(report.totals.revenueCents)} />
        ) : null}
        <KPICard title={SCHEDULED_HOURS_LABEL} value={formatScheduledHours(report.totals.scheduledHours)} />
        {showRevenue ? (
          <KPICard title="Average ticket" value={formatRevenueCents(report.totals.averageTicketCents)} />
        ) : null}
      </div>

      <ReportBlock title="By team" description="Everyone who finished a job together, counted once.">
        <DataTable
          headers={["Team", "Jobs", ...(showRevenue ? ["Revenue", "Average ticket"] : []), SCHEDULED_HOURS_LABEL]}
          rows={report.teams.map((team) => bucketCells(team, showRevenue))}
          emptyMessage="No completed jobs in this range."
        />
      </ReportBlock>

      <ReportBlock
        title="By person"
        description="Each person on a finished job. Scheduled hours are the whole job, so a shared job is listed for every person."
      >
        <DataTable
          headers={[
            "Person",
            "Jobs",
            ...(showRevenue ? ["Equal share", "Full job revenue", "Average ticket"] : []),
            SCHEDULED_HOURS_LABEL,
          ]}
          rows={report.people.map((person) => personCells(person, showRevenue))}
          emptyMessage="No completed jobs in this range."
        />
      </ReportBlock>

      <ReportBlock title="Jobs" description="Completed work inside the dates above.">
        <DataTable
          headers={[
            "Job",
            "Title",
            "Customer",
            "Team",
            "Completed",
            ...(showRevenue ? ["Revenue"] : []),
            SCHEDULED_HOURS_LABEL,
          ]}
          rows={report.jobs.map((job) => [
            job.jobNumber,
            job.title || "—",
            job.customerName || "—",
            job.team,
            job.completedOn,
            ...(showRevenue ? [formatRevenueCents(job.revenueCents)] : []),
            formatScheduledHours(job.scheduledHours),
          ])}
          emptyMessage="No completed jobs in this range."
        />
      </ReportBlock>
    </div>
  );
}

function bucketCells(bucket: ProductionBucket, showRevenue: boolean): string[] {
  return [
    bucket.label,
    String(bucket.jobs),
    ...(showRevenue
      ? [formatRevenueCents(bucket.revenueCents), formatRevenueCents(bucket.averageTicketCents)]
      : []),
    formatScheduledHours(bucket.scheduledHours),
  ];
}

function personCells(person: ProductionPersonBucket, showRevenue: boolean): string[] {
  return [
    person.label,
    String(person.jobs),
    ...(showRevenue
      ? [
          formatRevenueCents(person.equalShareCents),
          formatRevenueCents(person.fullJobRevenueCents),
          formatRevenueCents(person.averageTicketCents),
        ]
      : []),
    formatScheduledHours(person.scheduledHours),
  ];
}

function ReportBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}

function DataTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;
  return (
    <div className="min-w-0">
      <div className="space-y-3 md:hidden">
        {rows.map((cells, rowIndex) => (
          <div key={rowIndex} className="min-w-0 rounded-xl border border-default p-3">
            {cells.map((cell, cellIndex) => (
              <div key={cellIndex} className="flex min-w-0 items-start justify-between gap-3 py-1">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {headers[cellIndex]}
                </span>
                <span className="min-w-0 break-words text-right text-sm text-foreground">{cell}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-default">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="border-b border-default last:border-0">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
