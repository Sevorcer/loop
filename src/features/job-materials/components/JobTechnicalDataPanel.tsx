"use client";

import { useState } from "react";
import { BookOpen, Cpu, FileText, Info, Loader2 } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import type { InstalledSystemManual } from "@/features/manuals/types/manuals";

import { useJobTechnicalData } from "../state/JobTechnicalDataProvider";
import type { TechnicalDataSystem, TechnicalManualMatch } from "../types/jobMaterials";

const DRIVE_STATUS_LABEL: Record<InstalledSystemManual["status"], string> = {
  confirmed: "Drive · confirmed",
  auto_linked: "Drive · auto-linked",
  suggested: "Drive · suggested",
  rejected: "Drive · unlinked",
  match: "Drive · possible",
};

const MATCH_LABEL: Record<TechnicalManualMatch["matchedBy"], string> = {
  linked: "Linked",
  model: "Model match",
  manufacturer: "Brand guide",
};

function SystemCard({ system }: { system: TechnicalDataSystem }) {
  const identity = [system.manufacturer, system.modelNumber].filter(Boolean).join(" · ");
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={system.systemName}>
            {system.systemName}
          </p>
          {identity ? <p className="truncate text-xs text-slate-400">{identity}</p> : null}
          <p className="mt-0.5 text-xs text-slate-500">
            {[
              system.serialNumbers.length ? `S/N ${system.serialNumbers.join(", ")}` : null,
              system.location || null,
              system.installDate ? `Installed ${system.installDate}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            system.onThisJob
              ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
              : "border-white/10 bg-white/[0.04] text-slate-400"
          }`}
        >
          {system.onThisJob ? "On this job" : "At this property"}
        </span>
      </div>

      {system.sections.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {system.sections.map((section) => (
            <div key={section.key}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {section.label}
              </p>
              <dl className="mt-1 space-y-0.5">
                {section.facts.map((fact) => (
                  <div key={fact.label} className="flex gap-2 text-xs">
                    <dt className="text-slate-400">{fact.label}</dt>
                    <dd className="ml-auto text-right font-medium text-slate-100">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">No charge, clearance or electrical specs on file.</p>
      )}

      {system.recordFields.length > 0 ? (
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-2 text-xs">
          {system.recordFields.map((field) => (
            <div key={field.label} className="flex gap-1">
              <dt className="text-slate-500">{field.label}:</dt>
              <dd className="text-slate-200">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {system.manuals.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-white/5 pt-2" aria-label="Company Brain matches">
          {system.manuals.map((manual) => (
            <li key={manual.id} className="flex items-center gap-2 text-xs text-slate-300">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-violet-300" />
              <span className="min-w-0 flex-1 truncate" title={manual.title}>
                {manual.title}
              </span>
              <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                {MATCH_LABEL[manual.matchedBy]}
                {manual.status === "draft" ? " · draft" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {system.driveManuals.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-white/5 pt-2" aria-label="Drive manuals">
          {system.driveManuals.map((item) => (
            <li key={item.manual.id} className="flex items-center gap-2 text-xs text-slate-300">
              <FileText className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              {item.manual.webViewLink ? (
                <a
                  href={item.manual.webViewLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 flex-1 truncate hover:underline"
                  title={item.reason ? `${item.manual.name} — ${item.reason}` : item.manual.name}
                >
                  {item.manual.name}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate" title={item.manual.name}>
                  {item.manual.name}
                </span>
              )}
              <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                {DRIVE_STATUS_LABEL[item.status]}
                {item.status === "match" || item.status === "suggested" ? ` · ${Math.round(item.confidence * 100)}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Technical data (#23): specs pulled automatically from the job's equipment
 * records, their technical profiles, and Company Brain. Read-only here — fix
 * the source (Systems tab / Company Brain) and it shows up on every job.
 */
export function JobTechnicalDataPanel({ compact = false }: { compact?: boolean }) {
  const { data, loading, error } = useJobTechnicalData();
  const [showAll, setShowAll] = useState(false);

  const systems = data?.systems ?? [];
  const limit = compact ? 2 : 6;
  const visible = showAll ? systems : systems.slice(0, limit);

  const body = (
    <>
      <div className="flex items-start gap-3">
        {!compact ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/30">
            <Cpu className="h-5 w-5 text-violet-300" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className={compact ? "text-sm font-semibold text-white" : "text-lg font-semibold text-white"}>
            Technical data
          </h2>
          {!compact ? (
            <p className="mt-1 text-sm text-slate-400">
              Pulled automatically from the equipment on file, Company Brain and the Drive manuals.
            </p>
          ) : null}
        </div>
        {systems.length > 0 ? (
          <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
            {systems.length} {systems.length === 1 ? "system" : "systems"}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading technical data…
        </div>
      ) : (
        <>
          {data?.gaps.length ? (
            <ul className="mt-3 space-y-1">
              {data.gaps.map((gap) => (
                <li key={gap} className="flex items-start gap-2 text-xs text-amber-200/80">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {gap}
                </li>
              ))}
            </ul>
          ) : null}
          {visible.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {visible.map((system) => (
                <SystemCard key={system.id} system={system} />
              ))}
            </ul>
          ) : null}
          {systems.length > limit ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="mt-2 text-xs text-blue-300 hover:text-blue-200"
            >
              {showAll ? "Show fewer" : `Show all ${systems.length} systems`}
            </button>
          ) : null}
        </>
      )}
    </>
  );

  if (compact) return <div>{body}</div>;
  return (
    <SurfaceCard>
      <div className="p-6">{body}</div>
    </SurfaceCard>
  );
}
