"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { DateTimePicker } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import type { InspectionBookedBy, InspectionType } from "@/services/jobInspections";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobOption {
  id: string;
  jobNumber: string;
  customerName: string;
  title: string;
}

interface TeamPerson {
  id: string;
  name: string;
}

const INSPECTION_TYPES: { value: InspectionType; label: string }[] = [
  { value: "rough_in", label: "Rough-In" },
  { value: "cover", label: "Cover" },
  { value: "final", label: "Final" },
  { value: "other", label: "Other" },
];

const BOOKED_BY_OPTIONS: { value: InspectionBookedBy; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "gc_or_super", label: "GC / Super" },
  { value: "customer", label: "Customer" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScheduleInspectionDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  // ── Job search ──────────────────────────────────────────────────────────
  const [jobSearch, setJobSearch] = useState("");
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Team ────────────────────────────────────────────────────────────────
  const [team, setTeam] = useState<TeamPerson[]>([]);

  // ── Form fields ─────────────────────────────────────────────────────────
  const [inspectionType, setInspectionType] = useState<InspectionType>("rough_in");
  const [scheduledDate, setScheduledDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}T08:00`;
  });
  const [scheduledWindow, setScheduledWindow] = useState("");
  const [bookedBy, setBookedBy] = useState<InspectionBookedBy>("office");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // ── State ───────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Escape to close ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Load team on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void requestJson<{ team: TeamPerson[] }>("/api/calendar/team", { cache: "no-store" })
      .then((data) => {
        if (!cancelled) setTeam(data.team);
      })
      .catch(() => {
        // Team list is optional — techs can still be skipped.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Job search with debounce ───────────────────────────────────────────
  useEffect(() => {
    if (jobSearch.trim().length < 2) {
      setJobOptions([]);
      return;
    }
    const timeout = setTimeout(() => {
      setJobsLoading(true);
      void requestJson<{
        jobs: JobOption[];
        totalCount?: number;
      }>(
        `/api/jobs?page=1&pageSize=10&search=${encodeURIComponent(jobSearch.trim())}`,
        { cache: "no-store" },
      )
        .then((data) => {
          setJobOptions(
            (data.jobs ?? []).map((j) => ({
              id: j.id,
              jobNumber: j.jobNumber ?? "",
              customerName: j.customerName ?? "",
              title: j.title ?? "",
            })),
          );
          setShowDropdown(true);
        })
        .catch(() => setJobOptions([]))
        .finally(() => setJobsLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [jobSearch]);

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedJob) {
      setError("Select a job first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 1. Create the inspection record on the job.
      const inspectionBody = {
        inspectionType,
        scheduledDate: scheduledDate.length >= 10 ? scheduledDate.slice(0, 10) : null,
        scheduledWindow: scheduledWindow.trim() || null,
        bookedBy,
        notes: notes.trim() || null,
      };
      await requestJson(`/api/jobs/${selectedJob.id}/inspections`, {
        method: "POST",
        body: inspectionBody,
      });

      // 2. Create a calendar task so the inspection shows on the schedule.
      //    The calendar reads from the calendar_tasks table, not from
      //    job_inspections, so this entry is what places the inspection
      //    on the calendar and dispatch views.
      const typeLabel =
        INSPECTION_TYPES.find((t) => t.value === inspectionType)?.label ?? inspectionType;
      const taskTitle = `${typeLabel} Inspection — ${selectedJob.jobNumber || selectedJob.customerName}`;

      // Build start/end from the datetime-local value; default 1-hour block.
      const start = scheduledDate;
      const startMs = new Date(scheduledDate).getTime();
      const endDate = new Date(startMs + 60 * 60 * 1000);
      const end = [
        endDate.getFullYear(),
        "-",
        String(endDate.getMonth() + 1).padStart(2, "0"),
        "-",
        String(endDate.getDate()).padStart(2, "0"),
        "T",
        String(endDate.getHours()).padStart(2, "0"),
        ":",
        String(endDate.getMinutes()).padStart(2, "0"),
      ].join("");

      await requestJson("/api/calendar/tasks", {
        method: "POST",
        body: {
          title: taskTitle,
          description: notes.trim() || "",
          allDay: false,
          start,
          end,
          assignEveryone: assigneeIds.length === 0,
          assigneeIds,
          jobNumber: selectedJob.jobNumber,
          customerName: selectedJob.customerName,
          done: false,
        },
      });

      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not schedule the inspection.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    selectedJob,
    inspectionType,
    scheduledDate,
    scheduledWindow,
    bookedBy,
    assigneeIds,
    notes,
    onSaved,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-inspection-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-surface p-5 text-foreground shadow-atlas-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <h2 id="schedule-inspection-title" className="text-lg font-semibold">
            Schedule Inspection
          </h2>

          {/* ── Job selector ─────────────────────────────────────── */}
          <label className="block space-y-1 text-sm">
            <span>Job</span>
            {selectedJob ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                  {selectedJob.jobNumber} &mdash; {selectedJob.customerName || selectedJob.title}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJob(null);
                    setJobSearch("");
                  }}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    value={jobSearch}
                    onChange={(event) => setJobSearch(event.target.value)}
                    onFocus={() => {
                      if (jobOptions.length > 0) setShowDropdown(true);
                    }}
                    placeholder="Search by job number, customer, or title..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                    autoFocus
                  />
                  {jobsLoading && (
                    <span className="text-xs text-muted">Loading...</span>
                  )}
                </div>
                {showDropdown && jobOptions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-surface shadow-atlas-lg">
                    {jobOptions.map((job) => (
                      <li key={job.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJob(job);
                            setShowDropdown(false);
                            setJobSearch("");
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white/[0.06]"
                        >
                          <span className="font-medium">{job.jobNumber}</span>
                          <span className="ml-2 text-muted">
                            {job.customerName || job.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {showDropdown && jobSearch.trim().length >= 2 && !jobsLoading && jobOptions.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-white/10 bg-surface px-3 py-2 text-sm text-muted shadow-atlas-lg">
                    No jobs found
                  </div>
                )}
              </div>
            )}
          </label>

          {/* ── Inspection type ───────────────────────────────────── */}
          <label className="block space-y-1 text-sm">
            <span>Inspection Type</span>
            <select
              value={inspectionType}
              onChange={(event) => setInspectionType(event.target.value as InspectionType)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              {INSPECTION_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* ── Date/time ────────────────────────────────────────── */}
          <div className="space-y-1">
            <span className="text-sm">Date &amp; Time</span>
            <DateTimePicker
              value={scheduledDate}
              onChange={setScheduledDate}
              ariaLabel="Inspection date and time"
            />
          </div>

          {/* ── Time window ──────────────────────────────────────── */}
          <label className="block space-y-1 text-sm">
            <span>Time Window (optional)</span>
            <input
              value={scheduledWindow}
              onChange={(event) => setScheduledWindow(event.target.value)}
              placeholder="e.g. AM, PM, 8am-12pm"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            />
          </label>

          {/* ── Booked by ────────────────────────────────────────── */}
          <label className="block space-y-1 text-sm">
            <span>Booked By</span>
            <select
              value={bookedBy}
              onChange={(event) => setBookedBy(event.target.value as InspectionBookedBy)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              {BOOKED_BY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* ── Tech assignment ───────────────────────────────────── */}
          {team.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm">Assign Technicians (optional)</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 px-3 py-2">
                {team.map((person) => (
                  <label key={person.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={assigneeIds.includes(person.id)}
                      onChange={(event) => {
                        setAssigneeIds((current) =>
                          event.target.checked
                            ? [...current, person.id]
                            : current.filter((id) => id !== person.id),
                        );
                      }}
                    />
                    {person.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* ── Notes ────────────────────────────────────────────── */}
          <label className="block space-y-1 text-sm">
            <span>Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            />
          </label>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || !selectedJob}>
              {saving ? "Scheduling..." : "Schedule Inspection"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
