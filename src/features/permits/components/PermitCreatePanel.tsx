"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";

import { permitFieldClass, PermitFormFields } from "./PermitFormFields";
import {
  emptyPermitFormValues,
  permitWriteBody,
  validatePermitCreate,
  type PermitFormValues,
  type PermitWriteBody,
} from "./permitForm";

export interface PermitJobChoice {
  id: string;
  label: string;
}

interface JobSearchRow {
  id: string;
  jobNumber?: string | null;
  customerName?: string | null;
  propertyName?: string | null;
  title?: string | null;
}

function jobChoiceLabel(job: JobSearchRow): string {
  const number = (job.jobNumber ?? "").trim();
  const name =
    (job.customerName ?? "").trim() ||
    (job.propertyName ?? "").trim() ||
    (job.title ?? "").trim();
  if (number && name) return `${number} — ${name}`;
  return number || name || "Job";
}

interface PermitCreatePanelProps {
  open: boolean;
  onClose: () => void;
  onCreate: (jobId: string, fields: PermitWriteBody) => Promise<void>;
  /** When set, the permit is attached to this job and the picker is hidden. */
  lockedJob?: PermitJobChoice | null;
}

export function PermitCreatePanel({
  open,
  onClose,
  onCreate,
  lockedJob = null,
}: PermitCreatePanelProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<PermitFormValues>(emptyPermitFormValues);
  const [jobSearch, setJobSearch] = useState("");
  const [jobOptions, setJobOptions] = useState<PermitJobChoice[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PermitJobChoice | null>(null);

  const patchValues = useCallback((patch: Partial<PermitFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (lockedJob) return;
    const query = jobSearch.trim();
    if (query.length < 2) {
      setJobOptions([]);
      setJobsLoading(false);
      setShowResults(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      setJobsLoading(true);
      void requestJson<{ jobs: JobSearchRow[] }>(
        `/api/jobs?page=1&pageSize=10&search=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      )
        .then((data) => {
          if (cancelled) return;
          setJobOptions(
            (data.jobs ?? []).map((job) => ({
              id: job.id,
              label: jobChoiceLabel(job),
            })),
          );
          setShowResults(true);
        })
        .catch(() => {
          if (!cancelled) {
            setJobOptions([]);
            setShowResults(true);
          }
        })
        .finally(() => {
          if (!cancelled) setJobsLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [jobSearch, lockedJob]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const jobId = lockedJob?.id ?? selectedJob?.id ?? null;
      const problem = validatePermitCreate({ jobId, values });
      if (problem || !jobId) {
        setError(problem ?? "Select a job.");
        return;
      }

      setSaving(true);
      setError(null);
      try {
        await onCreate(jobId, permitWriteBody(values));
        onClose();
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Could not add the permit.",
        );
      } finally {
        setSaving(false);
      }
    },
    [lockedJob, selectedJob, values, onCreate, onClose],
  );

  if (!open) return null;

  const attachedJob = lockedJob ?? selectedJob;

  const panel = (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
        role="dialog"
        aria-label="Add permit"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">Add Permit</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="relative z-20 space-y-2 px-6 pt-5">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Job
            </label>
            {lockedJob ? (
              <p className={permitFieldClass}>{lockedJob.label}</p>
            ) : attachedJob ? (
              <div className="flex items-center gap-2">
                <p className={`${permitFieldClass} min-w-0 flex-1 truncate`}>
                  {attachedJob.label}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJob(null);
                    setJobSearch("");
                    setShowResults(false);
                  }}
                  className="shrink-0 text-xs text-muted transition-colors hover:text-primary"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(event) => setJobSearch(event.target.value)}
                  onFocus={() => {
                    if (jobOptions.length > 0) setShowResults(true);
                  }}
                  placeholder="Search by job number, customer, or title..."
                  aria-label="Search jobs"
                  autoComplete="off"
                  className={`${permitFieldClass} pl-10`}
                />
                {jobsLoading ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                    Loading...
                  </span>
                ) : null}
                {showResults && jobOptions.length > 0 ? (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-elevated py-1 shadow-xl">
                    {jobOptions.map((job) => (
                      <li key={job.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJob(job);
                            setShowResults(false);
                            setJobSearch("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-surface"
                        >
                          {job.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {showResults &&
                jobSearch.trim().length >= 2 &&
                !jobsLoading &&
                jobOptions.length === 0 ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-muted shadow-xl">
                    No jobs found
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <PermitFormFields values={values} onChange={patchValues} />
          </div>

          {error ? (
            <p role="alert" className="px-6 pb-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Permit"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}
