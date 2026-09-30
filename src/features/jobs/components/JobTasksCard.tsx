"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { JobTask } from "@/repositories/jobTasks";

/**
 * Office checklist card (round-2 feedback: "checklist sidebar on install
 * jobs — permits, warranty, entering equipment"). Per-job tasks stored in
 * job_tasks; install jobs get a one-click starter template. QA checklist
 * (required items for completion) lives in JobCompletionChecklistCard —
 * this card is the office/admin list, not the completion gate.
 */
export function JobTasksCard({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: string;
}) {
  const { role } = useCurrentRole();
  const [tasks, setTasks] = useState<JobTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(
    async (silent = false) => {
      if (!role) return;

      if (!silent) setLoading(true);
      try {
        const response = await requestJson<{ tasks: JobTask[] }>(
          `/api/jobs/${jobId}/tasks`,
          { role, cache: "no-store" },
        );
        setTasks(response.tasks ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load checklist.",
        );
      } finally {
        setLoading(false);
      }
    },
    [jobId, role],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadTasks();
    });
  }, [loadTasks]);

  const doneCount = tasks.filter((task) => task.isDone).length;

  async function addTask() {
    const label = newLabel.trim();
    if (!role || !label) return;

    setWorking(true);
    setError(null);
    try {
      const response = await requestJson<{ task: JobTask }>(
        `/api/jobs/${jobId}/tasks`,
        { role, method: "POST", body: { label } },
      );
      setTasks((current) => [...current, response.task]);
      setNewLabel("");
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Failed to add item.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function addTemplate() {
    if (!role) return;

    setWorking(true);
    setError(null);
    try {
      const response = await requestJson<{ tasks: JobTask[] }>(
        `/api/jobs/${jobId}/tasks`,
        { role, method: "POST", body: { template: "install" } },
      );
      setTasks(response.tasks ?? []);
    } catch (templateError) {
      setError(
        templateError instanceof Error
          ? templateError.message
          : "Failed to add checklist.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function toggleTask(task: JobTask) {
    if (!role) return;

    const nextDone = !task.isDone;
    // Optimistic
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, isDone: nextDone } : item,
      ),
    );

    try {
      await requestJson(`/api/jobs/${jobId}/tasks`, {
        role,
        method: "PATCH",
        body: { taskId: task.id, isDone: nextDone },
      });
    } catch (toggleError) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, isDone: task.isDone } : item,
        ),
      );
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update item.",
      );
    }
  }

  async function removeTask(task: JobTask) {
    if (!role) return;

    // Optimistic
    setTasks((current) => current.filter((item) => item.id !== task.id));

    try {
      await requestJson(`/api/jobs/${jobId}/tasks`, {
        role,
        method: "DELETE",
        body: { taskId: task.id },
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to remove item.",
      );
      void loadTasks(true);
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/30">
            <ClipboardList className="h-5 w-5 text-blue-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Office Checklist</h2>
            <p className="mt-1 text-sm text-slate-400">
              Permits, warranty, equipment entry — the office list for this job.
            </p>
          </div>
          {tasks.length > 0 ? (
            <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
              {doneCount} of {tasks.length} done
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading checklist…
          </div>
        ) : tasks.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-400">No checklist items yet.</p>
            {jobType === "Install" ? (
              <Button
                variant="secondary"
                onClick={() => void addTemplate()}
                disabled={working}
                className="gap-2"
              >
                <ClipboardList className="h-4 w-4" />
                Add install checklist
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={task.isDone}
                  onChange={() => void toggleTask(task)}
                  aria-label={task.label}
                  className="h-4 w-4 shrink-0"
                />
                <span
                  className={
                    task.isDone
                      ? "min-w-0 flex-1 truncate text-sm text-slate-500 line-through"
                      : "min-w-0 flex-1 truncate text-sm text-slate-200"
                  }
                  title={task.label}
                >
                  {task.label}
                </span>
                <button
                  type="button"
                  onClick={() => void removeTask(task)}
                  aria-label={`Remove ${task.label}`}
                  className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add custom item */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addTask();
              }
            }}
            placeholder="Add a checklist item…"
            maxLength={200}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/40"
          />
          <Button
            variant="secondary"
            onClick={() => void addTask()}
            disabled={working || !newLabel.trim()}
            className="shrink-0 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}
