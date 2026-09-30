"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ErrorState,
  KPICard,
  LoadingState,
  PageHeader,
  SectionCard,
} from "@/components/atlas";
import { useOperationalReports } from "../state/useOperationalReports";
import {
  currentMonthKey,
  isValidMonth,
  type OperationalReports,
} from "../utils/operationalReports";

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const date = new Date(Date.UTC(year, m, 1));
  const y = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mm}`;
}

function ReportTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-3 text-sm text-slate-400">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
            >
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 text-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-slate-300 hover:bg-white/[0.08]"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="month"
        value={month}
        onChange={(event) => {
          if (isValidMonth(event.target.value)) onChange(event.target.value);
        }}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white [color-scheme:dark]"
        aria-label="Report month"
      />
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-slate-300 hover:bg-white/[0.08]"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function InstallReportSection({ reports }: { reports: OperationalReports }) {
  const install = reports.install;
  return (
    <SectionCard
      title={`Install Report — ${reports.monthLabel}`}
      description="Install jobs by week and by tech. Unscheduled installs are counted in the total but not in a week."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard title="Installs" value={install.total} />
        <KPICard title="Unscheduled" value={install.unscheduled} />
      </div>

      <h4 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        By week
      </h4>
      <ReportTable
        headers={["Week", "Installs"]}
        rows={install.byWeek.map((week) => [week.label, String(week.count)])}
        emptyMessage="No weeks in this month."
      />

      <h4 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        By tech
      </h4>
      <ReportTable
        headers={["Tech", "Installs"]}
        rows={install.byTech.map((row) => [row.tech, String(row.count)])}
        emptyMessage="No installs this month."
      />

      <h4 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        Install jobs
      </h4>
      <ReportTable
        headers={["Job", "Title", "Customer", "Tech", "Date", "Status"]}
        rows={install.jobs.map((job) => [
          job.jobNumber,
          job.title || "—",
          job.customerName || "—",
          job.tech,
          job.date ?? "Unscheduled",
          job.status,
        ])}
        emptyMessage="No install jobs this month."
      />
    </SectionCard>
  );
}

function PipelineSection({ reports }: { reports: OperationalReports }) {
  const pipeline = reports.pipeline;
  return (
    <SectionCard
      title="Pipeline"
      description="Open estimates, booked work, completions, and the estimate close rate. Mark an estimate Completed when it's sold, Cancelled when it's lost."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard title="Open estimates" value={pipeline.openEstimates} />
        <KPICard title="Scheduled jobs" value={pipeline.scheduledJobs} />
        <KPICard
          title={`Completed — ${reports.monthLabel}`}
          value={pipeline.completedInMonth}
        />
        <KPICard
          title="Close rate"
          value={pct(pipeline.closeRate)}
          description={
            pipeline.closeRate == null
              ? "No estimates closed this month"
              : `${pipeline.estimatesWon} won · ${pipeline.estimatesLost} lost`
          }
        />
      </div>

      <h4 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        Open estimates
      </h4>
      <ReportTable
        headers={["Estimate", "Title", "Customer", "Status", "Tech"]}
        rows={pipeline.openEstimatesList.map((estimate) => [
          estimate.jobNumber,
          estimate.title || "—",
          estimate.customerName || "—",
          estimate.status,
          estimate.tech,
        ])}
        emptyMessage="No open estimates."
      />
    </SectionCard>
  );
}

function TechScorecardsSection({ reports }: { reports: OperationalReports }) {
  const scorecards = reports.techScorecards;
  return (
    <SectionCard
      title={`Tech Scorecards — ${reports.monthLabel}`}
      description="Jobs done, on-time completion, callbacks, and currently booked work per tech. On-time means finished on or before the scheduled date."
    >
      <ReportTable
        headers={["Tech", "Jobs done", "On-time", "Callbacks", "Callback rate", "Booked"]}
        rows={scorecards.map((card) => [
          card.tech,
          String(card.jobsDone),
          card.onTimePct == null ? "—" : pct(card.onTimePct),
          String(card.callbacks),
          card.callbackRate == null ? "—" : pct(card.callbackRate),
          String(card.booked),
        ])}
        emptyMessage="No tech activity to score."
      />
    </SectionCard>
  );
}

function CallbacksSection({ reports }: { reports: OperationalReports }) {
  const callbacks = reports.callbacks;
  return (
    <SectionCard
      title={`Callbacks & Rework — ${reports.monthLabel}`}
      description="Jobs typed as Callback. Create them from Jobs with type “Callback” to track rework here."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard title="Callbacks" value={callbacks.total} />
      </div>

      <h4 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        By tech
      </h4>
      <ReportTable
        headers={["Tech", "Callbacks"]}
        rows={callbacks.byTech.map((row) => [row.tech, String(row.count)])}
        emptyMessage="No callbacks this month."
      />

      <h4 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
        Callback jobs
      </h4>
      <ReportTable
        headers={["Job", "Title", "Customer", "Property", "Tech", "Date", "Status"]}
        rows={callbacks.jobs.map((job) => [
          job.jobNumber,
          job.title || "—",
          job.customerName || "—",
          job.propertyName || "—",
          job.tech,
          job.date ?? "—",
          job.status,
        ])}
        emptyMessage="No callback jobs this month."
      />
    </SectionCard>
  );
}

export function ReportingScreen() {
  const [month, setMonth] = useState(currentMonthKey());
  const { reports, loading, error } = useOperationalReports(month);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Reports"
          description="Installs, pipeline, tech scorecards, and callback tracking — computed from job data."
        />
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {loading ? (
        <LoadingState message="Loading reports..." />
      ) : error || !reports ? (
        <ErrorState
          title="Unable to load reports"
          description={
            error ?? "We couldn't load report data right now. Please try again shortly."
          }
        />
      ) : (
        <>
          <InstallReportSection reports={reports} />
          <PipelineSection reports={reports} />
          <TechScorecardsSection reports={reports} />
          <CallbacksSection reports={reports} />
        </>
      )}
    </div>
  );
}
