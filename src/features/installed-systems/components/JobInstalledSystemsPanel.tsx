"use client";

import { Cpu, FileCheck2, Link2, PlusCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { ROUTES } from "@/lib/routes";

import { useEffect, useMemo, useState } from "react"; import { actorDisplayName } from "@/lib/actors"; import { getSupabaseBrowserClient } from "@/lib/supabase/client"; import { useInstalledSystems } from "../state/InstalledSystemsProvider";
import type { InstalledSystem } from "../types/installedSystem";

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

interface JobInstalledSystemsPanelProps {
  jobId: string;
  jobNumber?: string;
  propertyId?: string;
  customerName?: string;
  propertyName?: string;
}

export function JobInstalledSystemsPanel({
  jobId,
  jobNumber,
  propertyId,
  customerName,
  propertyName,
}: JobInstalledSystemsPanelProps) {
  const { getInstalledSystemsForJob, getTechnicalProfileById } =
    useInstalledSystems();

  const systems = getInstalledSystemsForJob(jobId, propertyId);    const technicalIdentityIds = useMemo(     () =>       Array.from(         new Set(           systems             .map((system) => system.technicalIdentityId)             .filter((value): value is string => Boolean(value)),         ),       ),     [systems],   );   const [identityNames, setIdentityNames] = useState<Record<string, string>>({});    useEffect(() => {     let cancelled = false;     async function loadIdentityNames() {       if (technicalIdentityIds.length === 0) {         if (!cancelled) setIdentityNames({});         return;       }       try {         const supabase = getSupabaseBrowserClient();         const { data } = await supabase           .from("user_profiles")           .select("id, full_name, email")           .in("id", technicalIdentityIds);         if (cancelled) return;         const next: Record<string, string> = {};         for (const row of data ?? []) {           const profile = row as { id: string; full_name?: string | null; email?: string | null };           const label = profile.full_name?.trim() || profile.email?.trim() || null;           if (label) next[profile.id] = label;         }         setIdentityNames(next);       } catch {         if (!cancelled) setIdentityNames({});       }     }     void loadIdentityNames();     return () => {       cancelled = true;     };   }, [technicalIdentityIds]);    function technicalIdentityLabel(technicalIdentityId: string | null | undefined): string {     if (!technicalIdentityId) return "a team member";     const direct = actorDisplayName(technicalIdentityId);     if (direct) return direct;     return identityNames[technicalIdentityId] ?? "a team member";   }

  const addSystemParams = new URLSearchParams({
    ...(jobId ? { jobId } : {}),
    ...(jobNumber ? { jobNumber } : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(customerName ? { customerName } : {}),
    ...(propertyName ? { propertyName } : {}),
  });
  const addSystemHref = `${ROUTES.INSTALLED_SYSTEMS}/new?${addSystemParams.toString()}`;

  return (
    <SurfaceCard>
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-white/10">
              <Cpu className="h-5 w-5 text-blue-300" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Installed System Truth
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {systems.length > 0
                  ? "This job references technical truth from the installed system instead of duplicating permit and equipment data inside the job."
                  : "No installed systems have been recorded for this job yet."}
              </p>
            </div>
          </div>

          <PermissionGuard table="installed_systems" action="insert">
            <button
              type="button"
              onClick={() => {
                window.location.href = addSystemHref;
              }}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
            >
              <PlusCircle className="h-4 w-4" />
              Add System
            </button>
          </PermissionGuard>
        </div>
      </div>

      {systems.length > 0 ? (
        <div className="space-y-4 p-6">
          {systems.map((system) => {
            const profile = getTechnicalProfileById(system.technicalProfileId);

            return (
              <div
                key={system.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge variant={getMatchVariant(system)}>
                        {system.matchState === "exact"
                          ? "Catalog matched"
                          : system.matchState === "possible"
                            ? "Needs confirmation"
                            : "Unmatched"}
                      </StatusBadge>
                      <StatusBadge variant={getLifecycleVariant(system)}>
                        {system.lifecycleStatus}
                      </StatusBadge>
                      <StatusBadge
                        variant={system.permitReady ? "success" : "warning"}
                      >
                        {system.permitReady ? "Permit ready" : "Permit on hold"}
                      </StatusBadge>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {system.systemName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Technical identity {technicalIdentityLabel(system.technicalIdentityId)}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Estimate / Job
                      </p>
                      <p className="mt-1">
                        {system.estimateId ?? "Manual"} · {system.jobNumber ?? "No job"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Property
                      </p>
                      <p className="mt-1">{system.propertyName}</p>
                    </div>
                  </div>
                </div>

                <Link
                  href={`${ROUTES.INSTALLED_SYSTEMS}/${system.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
                >
                  <Link2 className="h-4 w-4" />
                  Open system record
                </Link>
              </div>

              {profile ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {profile.matchState === "exact" ? (
                    <>
                      <FactTile
                        icon={FileCheck2}
                        label="AHRI"
                        value={profile.permitFields.ahriNumber ?? "Pending"}
                      />
                      <FactTile
                        icon={FileCheck2}
                        label="Cooling"
                        value={
                          profile.permitFields.coolingCapacityBtu
                            ? `${profile.permitFields.coolingCapacityBtu.toLocaleString()} BTU`
                            : "Pending"
                        }
                      />
                      <FactTile
                        icon={FileCheck2}
                        label="Electrical"
                        value={`${profile.permitFields.voltage ?? "Pending"} · MCA ${
                          profile.permitFields.mca ?? "Pending"
                        } · MOCP ${profile.permitFields.mocp ?? "Pending"}`}
                      />
                    </>
                  ) : (
                    <div className="md:col-span-2 xl:col-span-3">
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                          {profile.confirmationNote ??
                            "Technical truth is pending confirmation, so permit fields stay referenced but unpopulated."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function FactTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileCheck2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-300" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}
