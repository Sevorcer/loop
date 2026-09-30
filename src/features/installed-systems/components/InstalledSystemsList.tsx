"use client";

import { ArrowRight, Cpu, FileCheck2, Plus, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { ROUTES } from "@/lib/routes";
import { formatDateOnly } from "@/lib/dates";

import { useInstalledSystems } from "../state/InstalledSystemsProvider";
import type {
  InstalledSystem,
  InstalledSystemLifecycle,
} from "../types/installedSystem";
import {
  EMPTY_SYSTEM_FILTER,
  filterInstalledSystems,
} from "../utils/installedSystemsUtils";

function getMatchVariant(system: InstalledSystem) {
  if (system.matchState === "exact") return "success" as const;
  if (system.matchState === "possible") return "warning" as const;
  return "danger" as const;
}

function getLifecycleVariant(system: InstalledSystem) {
  if (system.lifecycleStatus === "Active") return "success" as const;
  if (system.lifecycleStatus === "Planned") return "info" as const;
  return "warning" as const;
}

const LIFECYCLE_OPTIONS: Array<InstalledSystemLifecycle | "all"> = [
  "all",
  "Active",
  "Planned",
  "Needs Review",
];

export function InstalledSystemsList() {
  const { installedSystems, getTechnicalProfileById, loading } = useInstalledSystems();
  const [query, setQuery] = useState(EMPTY_SYSTEM_FILTER.query);
  const [lifecycle, setLifecycle] = useState<InstalledSystemLifecycle | "all">(
    EMPTY_SYSTEM_FILTER.lifecycle
  );

  const visibleSystems = useMemo(
    () => filterInstalledSystems(installedSystems, { query, lifecycle }),
    [installedSystems, query, lifecycle]
  );

  function clearFilters() {
    setQuery(EMPTY_SYSTEM_FILTER.query);
    setLifecycle(EMPTY_SYSTEM_FILTER.lifecycle);
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search systems, customers, properties…"
              aria-label="Search installed systems"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span className="whitespace-nowrap">Status</span>
            <select
              value={lifecycle}
              onChange={(event) =>
                setLifecycle(event.target.value as InstalledSystemLifecycle | "all")
              }
              aria-label="Filter by lifecycle status"
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none"
            >
              {LIFECYCLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All statuses" : option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SurfaceCard>

      {!loading && installedSystems.length === 0 && (
        <SurfaceCard className="p-8 text-center sm:p-12">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-lg font-semibold text-white">No installed systems yet</h3>
            <p className="text-sm leading-6 text-slate-400">
              Record the equipment you install and service — model, serial, and
              warranty live here, linked to the customer and property, so jobs
              and permits reference the same record.
            </p>
            <PermissionGuard table="installed_systems" action="insert">
              <Link
                href={`${ROUTES.INSTALLED_SYSTEMS}/new`}
                className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-gradient-to-r from-blue-500/80 to-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:from-blue-500 hover:to-cyan-700"
              >
                <Plus className="h-4 w-4" />
                Record your first system
              </Link>
            </PermissionGuard>
          </div>
        </SurfaceCard>
      )}

      {!loading && installedSystems.length > 0 && visibleSystems.length === 0 && (
        <SurfaceCard className="p-8 text-center sm:p-12">
          <div className="mx-auto max-w-md space-y-3">
            <h3 className="text-lg font-semibold text-white">No systems match</h3>
            <p className="text-sm leading-6 text-slate-400">
              Nothing matches the current search and filters.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.08]"
            >
              Clear search and filters
            </button>
          </div>
        </SurfaceCard>
      )}

      {visibleSystems.map((system) => {
        const profile = getTechnicalProfileById(system.technicalProfileId);

        return (
          <SurfaceCard key={system.id} className="overflow-hidden">
            <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant={getMatchVariant(system)}>
                    {system.matchState === "exact"
                      ? "Exact catalog match"
                      : system.matchState === "possible"
                        ? "Possible match"
                        : "Unmatched"}
                  </StatusBadge>
                  <StatusBadge variant={getLifecycleVariant(system)}>
                    {system.lifecycleStatus}
                  </StatusBadge>
                  <StatusBadge
                    variant={system.permitReady ? "success" : "warning"}
                  >
                    {system.permitReady ? "Permit ready" : "Awaiting confirmation"}
                  </StatusBadge>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {system.systemName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {system.propertyName} · {system.customerName}
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                  <Fact label="Technical identity" value={system.technicalIdentityId} />
                  <Fact label="Estimate" value={system.estimateId ?? "Historical asset"} />
                  <Fact label="Workflow reference" value={system.jobNumber ?? "Service linked"} />
                  <Fact
                    label="Install date"
                    value={formatDateOnly(system.installDate)}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <InsightTile
                    icon={Cpu}
                    title="Technical profile"
                    body={
                      profile?.matchState === "exact"
                        ? "Catalog truth is normalized into a workflow-ready technical profile."
                        : "Technical profile is created, but permit inheritance stays gated until the match is confirmed."
                    }
                  />
                  <InsightTile
                    icon={FileCheck2}
                    title="Permit inheritance"
                    body={
                      system.permitReady
                        ? "Office can open the permit workflow without re-looking up AHRI, capacity, or electrical values."
                        : "Permit fields remain intentionally blank until technical truth is trusted."
                    }
                  />
                  <InsightTile
                    icon={ShieldAlert}
                    title="Known vs discovered"
                    body={
                      profile?.discoveredFacts[0]?.value
                        ? `Field truth is preserved separately: ${profile.discoveredFacts[0].value}`
                        : "Field findings remain separate from manufacturer-backed truth."
                    }
                  />
                </div>
              </div>

              <Link
                href={`${ROUTES.INSTALLED_SYSTEMS}/${system.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
              >
                Open record
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
    </div>
  );
}

function InsightTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Cpu;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Icon className="h-4 w-4 text-blue-300" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}
