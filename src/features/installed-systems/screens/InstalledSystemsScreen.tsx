"use client";

import { CheckCircle2, Cpu, FileCheck2, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { PermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

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
    <div className="space-y-4 sm:space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200 sm:inline-flex">
              <Cpu className="h-3.5 w-3.5" />
              Assets · Technical Truth
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Installed Systems
              </h2>
              <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-slate-400 sm:block">
                Technical truth now flows from the equipment catalog into a
                normalized technical profile, then into each installed system,
                so jobs and permits can reference the same source of truth.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
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

          <PermissionGuard table="installed_systems" action="insert">
            <Link href={`${ROUTES.INSTALLED_SYSTEMS}/new`}>
              <Button className="gap-2 border border-blue-500/20 bg-gradient-to-r from-blue-500/80 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-700">
                <Plus className="h-4 w-4" />
                New System
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="text-base font-semibold text-white sm:text-lg">Architecture first</h3>
            <p className="mt-1.5 hidden text-sm leading-6 text-slate-400 sm:block">
              Equipment catalog entries own canonical manufacturer knowledge.
              LOOP derives a technical profile from trusted matches, then anchors
              the customer asset with a permanent technical identity. Jobs and
              permits consume those references instead of storing disconnected copies.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
            <ol className="space-y-2 text-sm text-slate-300 sm:space-y-3">
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
