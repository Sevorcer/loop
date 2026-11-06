"use client";

import { Flag } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ModalDialog } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { MATERIAL_EVENT_LABELS, type MaterialEventType } from "@/features/inventory/types/pulls";
import { requestJson } from "@/lib/api/client";

import { useJobMaterials } from "../../state/JobMaterialsProvider";
import type { JobMaterialLine } from "../../types/jobMaterials";
import { PlanError, PlanField } from "./PlanFormParts";
import { planFieldClass } from "./planStyles";

/** The events a line can report from the job panel. Capture only: nothing else changes. */
const LINE_EVENT_TYPES: readonly MaterialEventType[] = ["missing_part", "wrong_part", "substitution", "supply_house_run"];

const iconButton =
  "inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-atlas-md p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 sm:min-h-8 sm:min-w-8";

/** Report a missing or wrong part, a substitute, or "Bought on the way" for one plan line. */
export function ReportLineButton({ line }: { line: JobMaterialLine }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={iconButton} onClick={() => setOpen(true)} aria-label={`Report a problem with ${line.name}`}>
        <Flag size={14} aria-hidden="true" />
      </button>
      {open ? <ReportDialog line={line} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReportDialog({ line, onClose }: { line: JobMaterialLine; onClose: () => void }) {
  const { role } = useCurrentRole();
  const { jobId } = useJobMaterials();
  const [eventType, setEventType] = useState<MaterialEventType>("missing_part");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!role) return setError("Sign in again to continue.");
    setPending(true);
    setError(null);
    try {
      await requestJson(`/api/jobs/${encodeURIComponent(jobId)}/material-events`, {
        role,
        method: "POST",
        body: {
          eventType,
          lineId: line.id,
          itemId: line.catalogItemId,
          ...(qty.trim() ? { qty: Number(qty) } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setDone(true);
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : "Could not save that. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalDialog title="Report a problem" description={line.name} onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p role="status" className="status-success rounded-atlas-md px-3 py-2 text-sm">
            Saved. It helps the office fix this kit for the next job.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <PlanError message={error} />
          <PlanField label="What happened?" htmlFor="material-event-type">
            <select id="material-event-type" value={eventType} onChange={(e) => setEventType(e.target.value as MaterialEventType)} className={planFieldClass}>
              {LINE_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MATERIAL_EVENT_LABELS[type]}
                </option>
              ))}
            </select>
          </PlanField>
          <PlanField label={`How many (${line.unit})? Optional`} htmlFor="material-event-qty">
            <input id="material-event-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={planFieldClass} />
          </PlanField>
          <PlanField label="Note (optional)" htmlFor="material-event-note">
            <input id="material-event-note" value={note} onChange={(e) => setNote(e.target.value)} className={planFieldClass} maxLength={1000} />
          </PlanField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
