"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { pushToast } from "@/components/ui/toast";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { formatCentsAsUsd } from "@/lib/money";

import type { JobActivity } from "../types/jobActivity";

interface JobPriceEditorProps {
  jobId: string;
  status: string;
  initialCents: number | null;
  readOnly?: boolean;
  onRecorded?: (activity: JobActivity) => void;
}

function draftFromCents(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

export function JobPriceFields({
  jobId,
  status,
  initialCents,
  role,
  readOnly = false,
  onRecorded,
}: JobPriceEditorProps & { role: string | null }) {
  const router = useRouter();
  const [cents, setCents] = useState(initialCents);
  const [draft, setDraft] = useState(draftFromCents(initialCents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = !readOnly && status === "Completed" && cents == null;

  if (readOnly) {
    return (
      <SurfaceCard>
        <div className="space-y-2 p-6">
          <h2 className="text-lg font-semibold text-white">Amount to collect</h2>
          <p className="text-sm text-slate-300">
            {cents == null ? "No price entered yet." : formatCentsAsUsd(cents)}
          </p>
        </div>
      </SurfaceCard>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await requestJson<{ revenueCents: number | null; activity?: JobActivity | null }>(
        `/api/jobs/${jobId}/price`,
        {
          method: "PUT",
          role,
          body: { amount: draft },
        },
      );
      setCents(result.revenueCents);
      setDraft(draftFromCents(result.revenueCents));
      if (result.activity) onRecorded?.(result.activity);
      pushToast(result.revenueCents == null ? "Job price cleared." : "Job price saved.", "success");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The price could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard>
      <form className="space-y-3 p-6" onSubmit={(event) => void save(event)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Job price</h2>
          {missing ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
              Price not entered
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-300">
          {cents == null ? "No price yet." : formatCentsAsUsd(cents)}
          <span className="text-slate-400"> Reports use this amount as the job revenue.</span>
        </p>
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`job-price-${jobId}`}>
          Amount
          <input
            id={`job-price-${jobId}`}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="0.00"
            className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3 text-sm text-white"
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-full border border-white/15 px-4 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save price"}
        </button>
      </form>
    </SurfaceCard>
  );
}

export function JobPriceEditor({
  jobId,
  status,
  initialCents,
  readOnly = false,
  onRecorded,
}: JobPriceEditorProps) {
  const { role } = useCurrentRole();
  return (
    <JobPriceFields
      jobId={jobId}
      status={status}
      initialCents={initialCents}
      role={role}
      readOnly={readOnly}
      onRecorded={onRecorded}
    />
  );
}
