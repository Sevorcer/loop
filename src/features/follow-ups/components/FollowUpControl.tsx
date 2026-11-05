"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { JobFollowUpState } from "../types/followUp";
import { FOLLOW_UP_NOTE_MAX } from "../utils/followUpPatch";
import { formatFollowUpMarker } from "../utils/followUpFormat";

/** Job-detail control: flag the job for follow-up (part on order / return visit) with an optional note. */
export function FollowUpControl({ jobId }: { jobId: string }) {
  const { role } = useCurrentRole();
  const [state, setState] = useState<JobFollowUpState | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!role) return;
    try {
      const response = await requestJson<{ followUp: JobFollowUpState }>(`/api/jobs/${jobId}/follow-up`, {
        role,
        cache: "no-store",
      });
      setState(response.followUp);
      setNote(response.followUp.note ?? "");
    } catch {
      // The control stays hidden if the state can't be read.
    }
  }, [jobId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(needed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await requestJson<{ followUp: JobFollowUpState }>(`/api/jobs/${jobId}/follow-up`, {
        method: "PUT",
        role,
        body: { needed, note },
      });
      setState(response.followUp);
      setNote(response.followUp.note ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save follow-up.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const marker = formatFollowUpMarker(state.markedAt, null);

  return (
    <SurfaceCard>
      <div className="space-y-3 p-3 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
            <CalendarCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Follow-up
          </h2>
          {state.needed ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">Open</span>
          ) : null}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-slate-400">
            {state.needed ? "Note" : "Waiting on a part or a return visit? Add a note (optional)."}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={FOLLOW_UP_NOTE_MAX}
            rows={2}
            placeholder="e.g. Blower motor on order, return visit once it arrives"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
          />
        </label>
        {state.needed && marker ? <p className="text-[11px] text-slate-500">{marker}</p> : null}
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {state.needed ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={() => void save(true)}>
                {busy ? "Saving..." : "Save note"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(false)}>
                Clear follow-up
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={() => void save(true)}>
              {busy ? "Saving..." : "Mark for follow-up"}
            </Button>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
