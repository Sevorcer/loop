import { Activity, CheckCircle, XCircle, AlertTriangle, Clock, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { SectionCard } from "@/components/atlas/SectionCard";
import { KPICard } from "@/components/atlas/KPICard";
import { EmptyState } from "@/components/atlas/EmptyState";
import { listHealthRuns, getHealthRun } from "@/services/dbHealth";
import type { DbHealthCheckRun, DbHealthCheckResult, OverallStatus } from "../types";

// ---------------------------------------------------------------------------
// Sub-components (all server-rendered)
// ---------------------------------------------------------------------------

function OverallStatusBadge({ status }: { status: OverallStatus }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400 ring-1 ring-green-500/20">
        <CheckCircle size={12} />
        Healthy
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-500/20">
        <XCircle size={12} />
        Failed
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-400 ring-1 ring-yellow-500/20">
        <AlertTriangle size={12} />
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-muted ring-1 ring-default">
      <Clock size={12} />
      Unknown
    </span>
  );
}

function CheckResultRow({ result }: { result: DbHealthCheckResult }) {
  const isPass = result.status === "pass";
  const isCritical = result.severity === "critical" && !isPass;

  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 shrink-0">
        {isPass ? (
          <CheckCircle size={15} className="text-green-400" />
        ) : (
          <XCircle size={15} className={isCritical ? "text-red-400" : "text-yellow-400"} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{result.checkName.replace(/_/g, " ")}</span>
          {!isPass && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isCritical
                  ? "bg-red-500/10 text-red-400"
                  : "bg-yellow-500/10 text-yellow-400"
              }`}
            >
              {result.severity}
            </span>
          )}
          <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted">
            {result.checkCategory}
          </span>
        </div>
        {result.message && (
          <p className="mt-0.5 text-xs text-muted">{result.message}</p>
        )}
        {!isPass && (
          <p className="mt-0.5 text-[11px] text-muted">Owner: {result.owner}</p>
        )}
      </div>
    </div>
  );
}

function RunHistoryRow({ run }: { run: DbHealthCheckRun }) {
  const isFailing = run.failCount > 0;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex items-center gap-3">
        <OverallStatusBadge status={run.overallStatus} />
        <div>
          <p className="text-sm font-medium">
            {new Date(run.runAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" "}
            <span className="text-muted text-xs font-normal">
              {new Date(run.runAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
          <p className="text-xs text-muted capitalize">{run.trigger}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div>
          <span className={`text-sm font-semibold ${isFailing ? "text-red-400" : "text-green-400"}`}>
            {run.passCount}/{run.checkCount}
          </span>
          <p className="text-[11px] text-muted">passed</p>
        </div>
        {run.ciRunUrl && (
          <a
            href={run.ciRunUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition-colors hover:text-primary"
            title="View CI run"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export async function DbHealthScreen() {
  // Fetch the most recent 7 runs for history, and get full detail of the latest.
  let runs: DbHealthCheckRun[] = [];
  let latestRunId: string | null = null;
  let latestResults: DbHealthCheckResult[] = [];

  try {
    runs = await listHealthRuns(7);
    latestRunId = runs[0]?.id ?? null;

    if (latestRunId) {
      const detail = await getHealthRun(latestRunId);
      latestResults = detail?.results ?? [];
    }
  } catch {
    // If data fetching fails, we render empty states rather than crashing.
  }

  const latestRun = runs[0] ?? null;
  const failedResults = latestResults.filter((r) => r.status === "fail");
  const criticalCount = failedResults.filter((r) => r.severity === "critical").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="DB Health"
        description="Database integrity checks — schema, indexes, RLS coverage, and migration consistency. Updated daily."
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Status"
          value={
            latestRun
              ? latestRun.overallStatus.charAt(0).toUpperCase() + latestRun.overallStatus.slice(1)
              : "—"
          }
          icon={<Activity size={22} />}
          description={
            latestRun
              ? `Last run ${new Date(latestRun.runAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`
              : "No runs yet"
          }
        />
        <KPICard
          title="Checks Passed"
          value={latestRun ? `${latestRun.passCount}/${latestRun.checkCount}` : "—"}
          icon={<CheckCircle size={22} />}
          description="Latest run"
          trend={
            latestRun && latestRun.passCount === latestRun.checkCount
              ? { value: "All passing", positive: true }
              : latestRun && latestRun.failCount > 0
                ? { value: `${latestRun.failCount} failing`, positive: false }
                : undefined
          }
        />
        <KPICard
          title="Critical Issues"
          value={criticalCount}
          icon={<XCircle size={22} />}
          description="In latest run"
          trend={
            criticalCount === 0
              ? { value: "None", positive: true }
              : { value: "On-call alerted", positive: false }
          }
        />
        <KPICard
          title="Total Runs"
          value={runs.length}
          icon={<Clock size={22} />}
          description="Last 7 days shown"
        />
      </div>

      {/* Trend panel */}
      <SectionCard
        title="Run History"
        description="Pass/fail trend for the last 7 runs. Click the external link icon to view the CI log."
      >
        {runs.length === 0 ? (
          <EmptyState
            title="No runs yet"
            description="DB health checks will appear here once the daily workflow has run."
          />
        ) : (
          <div className="divide-y divide-default">
            {runs.map((run) => (
              <RunHistoryRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Latest failure details panel */}
      {latestRun && (
        <SectionCard
          title="Latest Run Details"
          description={`Run on ${new Date(latestRun.runAt).toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })} · ${latestRun.checkCount} checks · ${latestRun.durationMs ?? "—"}ms`}
        >
          {latestResults.length === 0 ? (
            <EmptyState
              title="No check results"
              description="Results will appear here after the first health check run."
            />
          ) : (
            <div className="divide-y divide-default">
              {/* Failed checks first */}
              {failedResults.length > 0 && (
                <div className="pb-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Failed
                  </p>
                  {failedResults.map((r) => (
                    <CheckResultRow key={r.id} result={r} />
                  ))}
                </div>
              )}
              {/* Passing checks */}
              {latestResults.filter((r) => r.status === "pass").length > 0 && (
                <div className="pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Passing
                  </p>
                  {latestResults
                    .filter((r) => r.status === "pass")
                    .map((r) => (
                      <CheckResultRow key={r.id} result={r} />
                    ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
