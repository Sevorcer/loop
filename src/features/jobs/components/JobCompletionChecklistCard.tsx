"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import {
  isRequiredQaChecklistComplete,
  type RequiredQaChecklist,
} from "@/features/jobs/utils/jobCompletionChecklist";

function ChecklistRow({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <span className="text-sm text-slate-200">{label}</span>
      {complete ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <Circle className="h-4 w-4 text-slate-500" />
      )}
    </div>
  );
}

export function JobCompletionChecklistCard({
  photosUploaded,
  installedSystemsEntered,
  jobNotesCompleted,
  initialChecklist,
  onSaveChecklist,
}: {
  photosUploaded: boolean;
  installedSystemsEntered: boolean;
  jobNotesCompleted: boolean;
  initialChecklist: RequiredQaChecklist;
  onSaveChecklist: (checklist: RequiredQaChecklist) => Promise<void>;
}) {
  const [qaChecklist, setQaChecklist] = useState<RequiredQaChecklist>(initialChecklist);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const qaComplete = isRequiredQaChecklistComplete(qaChecklist);
  const canComplete = useMemo(
    () => photosUploaded && installedSystemsEntered && jobNotesCompleted && qaComplete,
    [installedSystemsEntered, jobNotesCompleted, photosUploaded, qaComplete],
  );

  async function saveChecklist() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await onSaveChecklist(qaChecklist);
      setSuccess("QA checklist saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save QA checklist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Completion Checklist</h2>
            <p className="mt-1 text-sm text-slate-400">
              All checklist items must be complete before marking this job complete.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <ChecklistRow label="Photos uploaded" complete={photosUploaded} />
          <ChecklistRow label="Installed systems entered" complete={installedSystemsEntered} />
          <ChecklistRow label="Job notes completed" complete={jobNotesCompleted} />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <span className="text-sm text-slate-200">Customer signature</span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              Optional
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Required QA items
          </p>
          <div className="mt-3 space-y-2">
            {(
              [
                ["startupVerificationComplete", "Startup verification complete"],
                ["safetyReviewComplete", "Safety review complete"],
                ["workAreaCleaned", "Work area cleaned"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={qaChecklist[key]}
                  onChange={(event) =>
                    setQaChecklist((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={() => void saveChecklist()} disabled={saving}>
              {saving ? "Saving..." : "Save QA Checklist"}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {success}
          </p>
        ) : null}

        <p
          className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
            canComplete
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {canComplete
            ? "Completion checklist ready."
            : "Complete all checklist items before finishing this job."}
        </p>
      </div>
    </SurfaceCard>
  );
}
