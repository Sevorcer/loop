"use client";

import { Cpu, Plus, ShieldCheck, ShieldX, Timer } from "lucide-react";
import Link from "next/link";

import { PermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

import { InstalledSystemsList } from "../components/InstalledSystemsList";
import { useInstalledSystems } from "../state/InstalledSystemsProvider";

export function InstalledSystemsScreen() {
  const { counts, loading, error } = useInstalledSystems();

  // Tiles read exact, server-computed counts (never `.length` of a page that
  // PostgREST may have capped at 1,000 rows). While loading, or after a failed
  // load, show an em dash rather than a misleading "0".
  const tileValue = (value: number) =>
    error || loading ? "—" : value.toLocaleString();

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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={Cpu}
              value={tileValue(counts.total)}
              label="Systems"
            />
            <MetricCard
              icon={ShieldCheck}
              value={tileValue(counts.activeWarranties)}
              label="Active warranties"
            />
            <MetricCard
              icon={Timer}
              value={tileValue(counts.expiringSoon)}
              label="Expiring soon"
            />
            <MetricCard
              icon={ShieldX}
              value={tileValue(counts.expired)}
              label="Expired"
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

      <InstalledSystemsList />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Cpu;
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
