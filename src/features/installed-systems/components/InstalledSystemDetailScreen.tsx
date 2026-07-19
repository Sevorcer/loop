"use client";

import { ArrowLeft, Building2, Cpu, FileCheck2, HardHat, Wrench } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { ROUTES } from "@/lib/routes";

import { useInstalledSystems } from "../state/InstalledSystemsProvider";
import type { InstalledSystem } from "../types/installedSystem";

function getMatchVariant(state: InstalledSystem["matchState"]) {
  if (state === "exact") return "success" as const;
  if (state === "possible") return "warning" as const;
  return "danger" as const;
}

function getLifecycleVariant(status: InstalledSystem["lifecycleStatus"]) {
  if (status === "Active") return "success" as const;
  if (status === "Planned") return "info" as const;
  return "warning" as const;
}

export function InstalledSystemDetailScreen({
  installedSystem,
}: {
  installedSystem: InstalledSystem;
}) {
  const { getTechnicalProfileById, getCatalogEntryById } = useInstalledSystems();
  const profile = getTechnicalProfileById(installedSystem.technicalProfileId);
  const catalogEntries =
    profile?.catalogEntryIds
      .map((id) => getCatalogEntryById(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href={ROUTES.INSTALLED_SYSTEMS}>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]">
            <ArrowLeft className="h-4 w-4" />
            Back to Installed Systems
          </button>
        </Link>

        {installedSystem.propertyId ? (
          <Link
            href={`${ROUTES.PROPERTIES}/${installedSystem.propertyId}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
          >
            <Building2 className="h-4 w-4" />
            Open property
          </Link>
        ) : null}
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              <Cpu className="h-3.5 w-3.5" />
              Technical Identity
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {installedSystem.systemName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Permanent asset record for {installedSystem.propertyName}. Downstream
                workflows reference this system instead of owning duplicate technical
                data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={getMatchVariant(installedSystem.matchState)}>
                {installedSystem.matchState === "exact"
                  ? "Exact catalog match"
                  : installedSystem.matchState === "possible"
                    ? "Possible match"
                    : "Unmatched"}
              </StatusBadge>
              <StatusBadge variant={getLifecycleVariant(installedSystem.lifecycleStatus)}>
                {installedSystem.lifecycleStatus}
              </StatusBadge>
              <StatusBadge
                variant={installedSystem.permitReady ? "success" : "warning"}
              >
                {installedSystem.permitReady ? "Permit ready" : "Awaiting confirmation"}
              </StatusBadge>
            </div>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-white/10">
            <HardHat className="h-7 w-7 text-blue-300" />
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <SurfaceCard>
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-white">Technical profile</h2>
              <p className="mt-1 text-sm text-slate-400">
                Normalized truth derived from the equipment catalog and made ready
                for permit, warranty, and service workflows.
              </p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              <FactTile label="Identity" value={installedSystem.technicalIdentityId} />
              <FactTile label="Estimate" value={installedSystem.estimateId ?? "Historical asset"} />
              <FactTile label="Workflow" value={installedSystem.jobNumber ?? "Service linked"} />
              <FactTile label="Manufacturer" value={profile?.manufacturer ?? "Pending"} />
              <FactTile label="Equipment type" value={profile?.equipmentType ?? "Pending"} />
              <FactTile
                label="Match confidence"
                value={`${Math.round(installedSystem.matchConfidence * 100)}%`}
              />
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-white">Permit-ready inheritance</h2>
              <p className="mt-1 text-sm text-slate-400">
                These fields are read from the technical profile. The permit workflow
                is a consumer, not the owner, of this data.
              </p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
              <FactTile
                label="AHRI"
                value={profile?.permitFields.ahriNumber ?? "Pending confirmation"}
              />
              <FactTile
                label="Cooling"
                value={
                  profile?.permitFields.coolingCapacityBtu
                    ? `${profile.permitFields.coolingCapacityBtu.toLocaleString()} BTU`
                    : "Pending confirmation"
                }
              />
              <FactTile
                label="Heating"
                value={
                  profile?.permitFields.heatingCapacityBtu
                    ? `${profile.permitFields.heatingCapacityBtu.toLocaleString()} BTU`
                    : "Pending confirmation"
                }
              />
              <FactTile
                label="Voltage"
                value={profile?.permitFields.voltage ?? "Pending confirmation"}
              />
              <FactTile
                label="MCA / MOCP"
                value={
                  profile
                    ? `${profile.permitFields.mca ?? "Pending"} / ${
                        profile.permitFields.mocp ?? "Pending"
                      }`
                    : "Pending confirmation"
                }
              />
              <FactTile
                label="Efficiency"
                value={
                  profile?.permitFields.seer2
                    ? `${profile.permitFields.seer2} SEER2 · ${profile.permitFields.hspf2} HSPF2`
                    : "Pending confirmation"
                }
              />
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-white">Catalog-backed equipment</h2>
              <p className="mt-1 text-sm text-slate-400">
                Canonical manufacturer knowledge stays in the catalog and is referenced
                here through the technical profile.
              </p>
            </div>

            <div className="space-y-4 p-6">
              {catalogEntries.length > 0 ? (
                catalogEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge variant="info">{entry.role}</StatusBadge>
                      <StatusBadge variant="neutral">{entry.series}</StatusBadge>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white">
                      {entry.manufacturer} {entry.modelNumber}
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                      <Fact label="Manual" value={entry.documents.manual} />
                      <Fact label="Submittal" value={entry.documents.submittal} />
                      <Fact
                        label="Sound"
                        value={[
                          entry.sound?.indoorDb
                            ? `Indoor ${entry.sound.indoorDb} dB`
                            : null,
                          entry.sound?.outdoorDb
                            ? `Outdoor ${entry.sound.outdoorDb} dB`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Not recorded"}
                      />
                      <Fact
                        label="Dimensions"
                        value={entry.physical?.dimensions ?? "Not recorded"}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
                  No trusted catalog entry is attached yet. LOOP preserves the
                  estimate and field truth, but waits to auto-inherit permit data
                  until the match is confirmed.
                </div>
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-6">
          <SurfaceCard>
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-white">Known vs discovered</h2>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Known truth
                </div>
                <div className="mt-3 space-y-3">
                  {profile?.knownFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {fact.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-100">{fact.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                  <Wrench className="h-3.5 w-3.5" />
                  Discovered truth
                </div>
                <div className="mt-3 space-y-3">
                  {profile?.discoveredFacts.map((fact) => (
                    <div
                      key={`${fact.label}-${fact.value}`}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {fact.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-100">{fact.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="border-b border-white/10 px-6 py-5">
              <h2 className="text-lg font-semibold text-white">Operational history</h2>
            </div>

            <div className="space-y-3 p-6">
              {installedSystem.operationalHistory.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
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

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}
