"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FolderOpen, Loader2, Pencil, RefreshCw, Search } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { companyTimeZone } from "@/lib/timezone";

import { useDriveManuals } from "../state/DriveManualsProvider";
import type { DriveManualFile } from "../types/manuals";
import { MANUAL_DOC_TYPE_LABELS } from "../types/manuals";
import { manualLink } from "../utils/manualLink";
import { filterDriveManuals, manualKindLabel, manufacturerCounts } from "../utils/manualList";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    timeZone: companyTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ConnectionCard() {
  const { snapshot, syncing, syncError, sync } = useDriveManuals();
  if (!snapshot) return null;
  const { config, lastRun, canManage } = snapshot;

  if (!config.configured) {
    return (
      <SurfaceCard>
        <div className="space-y-2 p-4 sm:p-6">
          <p className="text-sm font-semibold text-amber-200">Google Drive is not connected yet</p>
          <p className="text-sm text-slate-400">
            Loop reads the manuals folder with a Google service account (view-only, names and
            links only — files stay in Drive). Until it is set up, this list stays empty.
          </p>
          {canManage && config.missing.length > 0 ? (
            <p className="text-xs text-slate-500">
              Waiting on: {config.missing.map((name) => (
                <code key={name} className="mr-1 rounded bg-white/5 px-1 py-0.5">{name}</code>
              ))}
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-white">
            Connected to Google Drive · {config.folderCount} folder{config.folderCount === 1 ? "" : "s"}
          </p>
          {canManage ? (
            <p className="text-xs text-slate-400">
              {lastRun
                ? `Last sync ${formatWhen(lastRun.finishedAt ?? lastRun.startedAt)} — ${
                    lastRun.status === "ok"
                      ? `${lastRun.filesSeen} files (${lastRun.filesAdded} new, ${lastRun.filesRemoved} removed)`
                      : lastRun.status === "error"
                        ? `failed: ${lastRun.error ?? "unknown error"}`
                        : "running"
                  }`
                : "Not synced yet."}
            </p>
          ) : null}
          {canManage ? (
            <p className="text-xs text-slate-500">
              {config.customerFolderConfigured
                ? "Customer manuals folder set — manuals in it can be linked from the builder portal."
                : "No Customer manuals folder set — nothing is shown in the builder portal."}
            </p>
          ) : null}
          {syncError ? <p className="text-xs text-red-300">{syncError}</p> : null}
        </div>
        {canManage ? (
          <Button onClick={() => void sync()} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync from Drive"}
          </Button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function OverrideEditor({ file, onDone }: { file: DriveManualFile; onDone: () => void }) {
  const { updateManual } = useDriveManuals();
  const [manufacturer, setManufacturer] = useState(file.manufacturerOverride ?? file.manufacturer ?? "");
  const [model, setModel] = useState(file.modelOverride ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateManual(file.id, { manufacturer: manufacturer.trim() || null, model: model.trim() || null });
      onDone();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-400">
        Manufacturer
        <input
          className="mt-1 block w-40 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
          value={manufacturer}
          maxLength={100}
          onChange={(event) => setManufacturer(event.target.value)}
        />
      </label>
      <label className="text-xs text-slate-400">
        Model (optional)
        <input
          className="mt-1 block w-40 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
          value={model}
          maxLength={100}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <Button size="sm" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone} disabled={saving}>
        Cancel
      </Button>
      {error ? <p className="w-full text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function ManualRow({ file, canManage }: { file: DriveManualFile; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const link = manualLink(file);
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={link?.href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-white hover:underline"
            title={file.name}
          >
            <span className="truncate">{file.name}</span>
            {link?.external ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
          </a>
          <p className="mt-0.5 text-xs text-slate-400">
            {[
              file.manufacturer ?? "Brand unknown",
              file.models.length ? file.models.join(", ") : null,
              MANUAL_DOC_TYPE_LABELS[file.docType],
              manualKindLabel(file),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <FolderOpen className="h-3 w-3" />
            {file.folderPath || "Drive"} · updated {formatWhen(file.driveModifiedAt)}
            {file.portalEligible ? (
              <span className="ml-1 rounded-full border border-sky-400/30 px-1.5 py-px text-[10px] font-medium text-sky-200">
                Builder portal
              </span>
            ) : null}
          </p>
        </div>
        {canManage && !editing ? (
          <Button size="xs" variant="ghost" className="gap-1" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
            Fix brand / model
          </Button>
        ) : null}
      </div>
      {editing ? <OverrideEditor file={file} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}

export function DriveManualsScreen() {
  const { snapshot, loading, error, refresh } = useDriveManuals();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const deferredQuery = useDeferredValue(query);

  const files = useMemo(() => snapshot?.files ?? [], [snapshot]);
  const brands = useMemo(() => manufacturerCounts(files), [files]);
  const visible = useMemo(() => filterDriveManuals(files, deferredQuery, brand), [files, deferredQuery, brand]);

  if (loading && !snapshot) return <LoadingState message="Loading Drive manuals…" />;
  if (error && !snapshot) {
    return <ErrorState title="Unable to load Drive manuals" description={error} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <Link href={ROUTES.COMPANY_BRAIN} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Company Brain
        </Link>
      </div>

      <SurfaceCard>
        <div className="space-y-1 p-4 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">Drive manuals</h2>
          <p className="text-sm text-slate-400">
            Install guides, service manuals and field references from Google Drive. Drive stays the
            source of truth — Loop keeps the name, folder and a link, and matches them to equipment by
            brand and model.
          </p>
        </div>
      </SurfaceCard>

      <ConnectionCard />

      {files.length === 0 ? (
        <EmptyState
          title="No manuals indexed yet"
          description={
            snapshot?.config.configured
              ? "Run “Sync from Drive” to pull in the shared folders."
              : "Manuals will appear once Google Drive is connected and synced."
          }
          icon={<FolderOpen className="h-5 w-5" />}
          action={
            <Button variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />
      ) : (
        <SurfaceCard>
          <div className="space-y-3 p-4 sm:p-6">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                aria-label="Search manuals"
                placeholder="Search by name, brand, model or folder"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {brands.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setBrand("")}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${brand === "" ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-white/10 text-slate-400"}`}
                >
                  All · {files.length}
                </button>
                {brands.map((entry) => (
                  <button
                    key={entry.manufacturer}
                    type="button"
                    onClick={() => setBrand(entry.manufacturer === brand ? "" : entry.manufacturer)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${brand === entry.manufacturer ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-white/10 text-slate-400"}`}
                  >
                    {entry.manufacturer} · {entry.count}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              Showing {visible.length} of {files.length}
            </p>
            <ul className="space-y-2">
              {visible.map((file) => (
                <ManualRow key={file.id} file={file} canManage={!!snapshot?.canManage} />
              ))}
            </ul>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
