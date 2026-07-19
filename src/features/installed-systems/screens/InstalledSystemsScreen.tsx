"use client";

import { CheckCircle2, Cpu, FileCheck2, ShieldAlert } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import { InstalledSystemsList } from "../components/InstalledSystemsList";
import { useInstalledSystems } from "../state/InstalledSystemsProvider";

export function InstalledSystemsScreen() {
  const { installedSystems } = useInstalledSystems();

  const exactMatches = installedSystems.filter(
    (system) => system.matchState === "exact"
  ).length;
  const permitReady = installedSystems.filter((system) => system.permitReady).length;
  const needsReview = installedSystems.filter(
    (system) => system.matchState !== "exact"
  ).length;

  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              <Cpu className="h-3.5 w-3.5" />
              Assets · Technical Truth
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Installed Systems
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Technical truth now flows from the equipment catalog into a
                normalized technical profile, then into each installed system,
                so jobs and permits can reference the same source of truth.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              icon={CheckCircle2}
              value={String(exactMatches)}
              label="Exact catalog matches"
            />
            <MetricCard
              icon={FileCheck2}
              value={String(permitReady)}
              label="Permit-ready systems"
            />
            <MetricCard
              icon={ShieldAlert}
              value={String(needsReview)}
              label="Needs confirmation"
            />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="grid gap-6 p-6 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="text-lg font-semibold text-white">Architecture first</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Equipment catalog entries own canonical manufacturer knowledge.
              LOOP derives a technical profile from trusted matches, then anchors
              the customer asset with a permanent technical identity. Jobs and
              permits consume those references instead of storing disconnected copies.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <ol className="space-y-3 text-sm text-slate-300">
              <li>1. Estimate accepted with equipment selected</li>
              <li>2. Job created and linked to a technical identity</li>
              <li>3. Equipment catalog matching establishes confidence</li>
              <li>4. Technical profile normalizes permit-ready truth</li>
              <li>5. Future workflows reference the installed system record</li>
            </ol>
          </div>
        </div>
      </SurfaceCard>

      <InstalledSystemsList />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof CheckCircle2;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-4 w-4 text-blue-300" />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
