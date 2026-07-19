"use client";

import { ArrowRight, Cpu, FileCheck2, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { ROUTES } from "@/lib/routes";

import { useInstalledSystems } from "../state/InstalledSystemsProvider";
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

export function InstalledSystemsList() {
  const { installedSystems, getTechnicalProfileById } = useInstalledSystems();

  return (
    <div className="space-y-4">
      {installedSystems.map((system) => {
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
                    value={new Date(system.installDate).toLocaleDateString()}
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
