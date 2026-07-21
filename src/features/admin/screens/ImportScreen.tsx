"use client";

/**
 * ImportScreen — generic CSV import UI for admin entities.
 *
 * Three phases:
 *   1. Upload — file picker + entity info
 *   2. Preview — dry-run results with error table
 *   3. Success — commit summary
 */

import { Upload, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { useRef, useState } from "react";

import { EmptyState } from "@/components/atlas/EmptyState";
import { PageHeader } from "@/components/atlas/PageHeader";
import { Button } from "@/components/ui/button";
import type { ImportResult, ImportRowError } from "@/lib/schemas/import";
import { useCurrentRole } from "@/features/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupportedEntity = "customers" | "properties" | "jobs";

type Phase = "upload" | "preview" | "success";

interface ImportScreenProps {
  entity: SupportedEntity;
  title: string;
  description: string;
  csvInstructions: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportScreen({
  entity,
  title,
  description,
  csvInstructions,
}: ImportScreenProps) {
  const { role } = useCurrentRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setApiError(null);
    setDryRunResult(null);
    setPhase("upload");
  }

  async function handleDryRun() {
    if (!selectedFile) return;
    setIsLoading(true);
    setApiError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const headers: HeadersInit = {};
      if (role) headers["X-Loop-Role"] = role;

      const res = await fetch(`/api/import/${entity}?mode=dry_run`, {
        method: "POST",
        headers,
        body: form,
      });

      const data: ImportResult | { error: string; message: string } = await res.json();

      if (!res.ok) {
        const errData = data as { message: string };
        setApiError(errData.message ?? "Validation failed.");
        return;
      }

      setDryRunResult(data as ImportResult);
      setPhase("preview");
    } catch {
      setApiError("Failed to connect to the import API.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCommit() {
    if (!selectedFile) return;
    setIsLoading(true);
    setApiError(null);

    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const headers: HeadersInit = {};
      if (role) headers["X-Loop-Role"] = role;

      const res = await fetch(`/api/import/${entity}?mode=commit`, {
        method: "POST",
        headers,
        body: form,
      });

      const data: ImportResult | { error: string; message: string } = await res.json();

      if (!res.ok) {
        const errData = data as { message: string };
        setApiError(errData.message ?? "Commit failed.");
        return;
      }

      setCommitResult(data as ImportResult);
      setPhase("success");
    } catch {
      setApiError("Failed to connect to the import API.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setDryRunResult(null);
    setCommitResult(null);
    setApiError(null);
    setPhase("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasErrors = (dryRunResult?.errors.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      {/* ── Phase 1: Upload ── */}
      {phase === "upload" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">CSV Format</h3>
            <p className="text-xs leading-6 text-slate-400">{csvInstructions}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <label className="block cursor-pointer">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/20 p-10 text-center transition-colors hover:border-white/40">
                <Upload className="h-8 w-8 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedFile ? selectedFile.name : "Choose a CSV file"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                      : "or drag and drop"}
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {apiError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {apiError}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleDryRun}
              disabled={!selectedFile || isLoading}
              className="gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700"
            >
              <FileText className="h-4 w-4" />
              {isLoading ? "Validating…" : "Validate (Dry Run)"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Phase 2: Preview ── */}
      {phase === "preview" && dryRunResult && (
        <div className="space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total rows", value: dryRunResult.total },
              { label: "Would insert", value: dryRunResult.total - (dryRunResult.errors.length > 0 ? dryRunResult.total : 0) },
              { label: "Errors", value: dryRunResult.errors.length },
              { label: "File", value: selectedFile?.name ?? "—" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Error table */}
          {hasErrors ? (
            <div className="rounded-2xl border border-red-500/20 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold text-white">
                  Validation errors — fix your CSV and re-upload
                </h3>
              </div>
              <ErrorTable errors={dryRunResult.errors} />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-300">
                All {dryRunResult.total} rows passed validation. Ready to commit.
              </p>
            </div>
          )}

          {apiError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {apiError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset} className="border-white/20 text-slate-300 hover:text-white">
              ← Re-upload
            </Button>
            <Button
              onClick={handleCommit}
              disabled={hasErrors || isLoading}
              className="gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700 disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              {isLoading ? "Importing…" : `Commit ${dryRunResult.total} rows`}
            </Button>
          </div>
        </div>
      )}

      {/* ── Phase 3: Success ── */}
      {phase === "success" && commitResult && (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Import complete</h3>
              <p className="mt-1 text-sm text-slate-400">
                {commitResult.inserted} {entity} record
                {commitResult.inserted !== 1 ? "s" : ""} imported successfully.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total rows", value: commitResult.total },
              { label: "Inserted", value: commitResult.inserted },
              { label: "Skipped", value: commitResult.skipped },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button variant="outline" onClick={handleReset} className="border-white/20 text-slate-300 hover:text-white">
              Import another file
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty state when no file yet chosen and upload phase ── */}
      {phase === "upload" && !selectedFile && (
        <EmptyState
          icon={<Upload size={20} />}
          title="No file selected"
          description="Choose a CSV file above to begin the import validation process."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorTable({ errors }: { errors: ImportRowError[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Row
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Field
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Error
            </th>
          </tr>
        </thead>
        <tbody>
          {errors.map((err, i) => (
            <tr key={i} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
              <td className="px-6 py-3 font-mono text-slate-300">{err.row}</td>
              <td className="px-6 py-3 font-mono text-red-300">{err.field}</td>
              <td className="px-6 py-3 text-slate-400">{err.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Re-export the row error type for import pages
export type { ImportRowError };
