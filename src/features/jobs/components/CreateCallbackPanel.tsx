"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { DateTimePicker } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import type { JobCallbackContext } from "@/features/jobs/types/jobCallback";
import { canCreateCallback, callbackReasonError } from "@/features/jobs/utils/callbackJob";
import { parseDatetimeLocalInput } from "@/features/jobs/utils/schedulingTime";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { JobStatus } from "../types/job";

export function CreateCallbackPanel({
  jobId,
  status,
  callbackContext,
}: {
  jobId: string;
  status: JobStatus;
  callbackContext: JobCallbackContext;
}) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [reason, setReason] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const canCreate = status === "Completed" && canCreateCallback(role);
  if (!canCreate && !createdJobId) return null;

  async function createCallback() {
    const reasonError = callbackReasonError(reason);
    if (reasonError) {
      setError(reasonError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const headers = new Headers({ "content-type": "application/json" });
      if (process.env.NODE_ENV !== "production" && role) {
        headers.set("x-loop-role", role);
      }
      const response = await fetch(`/api/jobs/${jobId}/callback`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          reason: reason.trim(),
          scheduledStartAt: scheduledStartAt
            ? parseDatetimeLocalInput(scheduledStartAt)
            : null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; job?: { id: string } }
        | null;
      if (!response.ok || !payload?.job) {
        throw new Error(payload?.message ?? "Couldn't create the return visit.");
      }
      setCreatedJobId(payload.job.id);
      setReason("");
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Couldn't create the return visit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
            <RotateCcw className="h-5 w-5 text-amber-200" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Callback</h2>
            <p className="mt-1 text-sm text-slate-400">
              Open a return visit for the same customer, property, and equipment.
            </p>
          </div>
        </div>

        {callbackContext.returnVisits.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {callbackContext.returnVisits.map((visit) => (
              <li key={visit.id} className="text-sm text-slate-300">
                <Link href={ROUTE_BUILDERS.JOB_DETAIL(visit.id)} className="text-blue-300 hover:underline">
                  {visit.jobNumber}
                </Link>
                <span className="text-slate-500"> — {visit.reason}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {createdJobId ? (
          <p className="mt-4 text-sm text-emerald-200">
            Return visit created.{" "}
            <Link href={ROUTE_BUILDERS.JOB_DETAIL(createdJobId)} className="underline">
              Open it
            </Link>
            .
          </p>
        ) : null}

        {canCreate && !createdJobId ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-200" htmlFor={`callback-reason-${jobId}`}>
              Why does the customer need a return visit?
            </label>
            <textarea
              id={`callback-reason-${jobId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Still not cooling after the first visit"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-amber-500/40"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Schedule the return visit <span className="text-slate-500">(optional)</span>
              </label>
              <DateTimePicker
                id={`callback-start-${jobId}`}
                ariaLabel="Callback scheduled start"
                value={scheduledStartAt}
                onChange={setScheduledStartAt}
              />
            </div>
            <Button
              type="button"
              className="min-h-[48px] w-full sm:w-auto"
              onClick={() => void createCallback()}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create callback"}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
