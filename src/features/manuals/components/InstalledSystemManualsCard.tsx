"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ExternalLink, Link2, Loader2, Sparkles, Unlink, Wand2 } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { useInstalledSystemManuals } from "../state/useInstalledSystemManuals";
import type { InstalledSystemManual, MatchConfidenceLevel, SystemPlacementJob } from "../types/manuals";
import { MANUAL_DOC_TYPE_LABELS } from "../types/manuals";

const LEVEL_STYLE: Record<MatchConfidenceLevel, string> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  low: "border-white/10 bg-white/[0.04] text-slate-400",
};

const LEVEL_LABEL: Record<MatchConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Brand guide",
};

function statusLabel(item: InstalledSystemManual): string {
  if (item.status === "confirmed") return "Confirmed by office";
  if (item.status === "auto_linked") return "Linked automatically";
  if (item.status === "suggested") return "Copilot suggestion";
  return "Possible match";
}

const JOB_BASIS: Record<SystemPlacementJob["basis"], string> = {
  linked: "Linked job",
  install_date: "Install job (matched by install date)",
  latest_install: "Latest install job at this property",
};

function ManualItem({
  item,
  canManage,
  pending,
  onDecide,
}: {
  item: InstalledSystemManual;
  canManage: boolean;
  pending: boolean;
  onDecide: (action: "confirm" | "unlink") => void;
}) {
  const isLinked = item.status === "confirmed" || item.status === "auto_linked";
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={item.manual.webViewLink || undefined}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-white hover:underline"
            title={item.manual.name}
          >
            <span className="truncate">{item.manual.name}</span>
            {item.manual.webViewLink ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
          </a>
          <p className="mt-0.5 text-xs text-slate-400">
            {[MANUAL_DOC_TYPE_LABELS[item.manual.docType], item.manual.manufacturer, statusLabel(item)]
              .filter(Boolean)
              .join(" · ")}
            {item.manual.status === "removed" ? " · no longer in Drive" : ""}
          </p>
          {item.reason ? <p className="mt-0.5 text-xs text-slate-500">{item.reason}</p> : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${LEVEL_STYLE[item.level]}`}>
          {LEVEL_LABEL[item.level]} · {Math.round(item.confidence * 100)}%
        </span>
      </div>
      {canManage ? (
        <div className="mt-2 flex gap-2">
          {item.status !== "confirmed" ? (
            <Button size="xs" variant="outline" className="gap-1" disabled={pending} onClick={() => onDecide("confirm")}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Confirm
            </Button>
          ) : null}
          <Button size="xs" variant="ghost" className="gap-1" disabled={pending} onClick={() => onDecide("unlink")}>
            <Unlink className="h-3 w-3" />
            {isLinked ? "Unlink" : "Not this one"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function InstalledSystemManualsCard({ systemId }: { systemId: string }) {
  const { view, loading, error, pendingId, decide } = useInstalledSystemManuals(systemId);
  const [pick, setPick] = useState("");

  return (
    <SurfaceCard>
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <BookOpen className="h-4 w-4 text-violet-300" />
          Manuals
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Install and service manuals from Google Drive, matched to this equipment by brand and model.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {loading && !view ? (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading manuals…
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {view ? (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Auto-placed info</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {view.placement.nameplate.map((fact) => (
                  <div key={fact.label} className="flex gap-1">
                    <dt className="text-slate-500">{fact.label}:</dt>
                    <dd className="truncate text-slate-200" title={fact.value}>{fact.value}</dd>
                  </div>
                ))}
                {view.placement.recordFields.map((fact) => (
                  <div key={fact.label} className="flex gap-1">
                    <dt className="text-slate-500">{fact.label}:</dt>
                    <dd className="truncate text-slate-200" title={fact.value}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {view.placement.job ? (
                <p className="mt-2 text-xs text-slate-400">
                  {JOB_BASIS[view.placement.job.basis]}:{" "}
                  <Link href={ROUTE_BUILDERS.JOB_DETAIL(view.placement.job.id)} className="text-blue-300 hover:underline">
                    {[view.placement.job.jobNumber, view.placement.job.title].filter(Boolean).join(" — ") || "Open job"}
                  </Link>
                  {view.placement.job.scheduledFor ? ` · ${view.placement.job.scheduledFor}` : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No install job found for this equipment.</p>
              )}
            </div>

            <div>
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <Link2 className="h-3.5 w-3.5" /> Linked manuals
              </p>
              {view.linked.length ? (
                <ul className="mt-2 space-y-2">
                  {view.linked.map((item) => (
                    <ManualItem
                      key={item.manual.id}
                      item={item}
                      canManage={view.canManage}
                      pending={pendingId === item.manual.id}
                      onDecide={(action) => void decide(item.manual.id, action)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No manual linked yet.</p>
              )}
            </div>

            <div>
              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                <Sparkles className="h-3.5 w-3.5" /> Possible matches
              </p>
              {view.suggestions.length ? (
                <ul className="mt-2 space-y-2">
                  {view.suggestions.map((item) => (
                    <ManualItem
                      key={item.manual.id}
                      item={item}
                      canManage={view.canManage}
                      pending={pendingId === item.manual.id}
                      onDecide={(action) => void decide(item.manual.id, action)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {view.driveConnected
                    ? "No manual in the Drive index matches this brand or model."
                    : "Google Drive is not connected yet, so there are no manuals to match."}
                </p>
              )}
              {view.rejectedCount > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {view.rejectedCount} manual{view.rejectedCount === 1 ? "" : "s"} marked “not this one”.
                </p>
              ) : null}
            </div>

            {view.canManage && view.library.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-white/5 pt-4">
                <label className="min-w-0 flex-1 text-xs text-slate-400">
                  Link another manual
                  <select
                    className="mt-1 block w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white"
                    value={pick}
                    onChange={(event) => setPick(event.target.value)}
                  >
                    <option value="">Choose a manual…</option>
                    {view.library.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.manufacturer ? `${entry.manufacturer} — ` : ""}
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={!pick || pendingId === pick}
                  onClick={() => {
                    void decide(pick, "confirm").then((ok) => {
                      if (ok) setPick("");
                    });
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" /> Link
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
