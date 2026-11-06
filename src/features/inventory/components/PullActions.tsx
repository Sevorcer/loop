"use client";

import { Flag, Printer } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { PullResult } from "../types/pulls";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError, FormWarning } from "./FormMessages";
import { fieldClass } from "./formStyles";

/** What a pull answered: say how many moved, and name anything the shelf could not cover. */
function pullMessage(data: unknown): string | null {
  const result = data as Partial<PullResult> | undefined;
  const short = result?.short?.length ?? 0;
  if (short === 0) return null;
  return short === 1
    ? "1 line could not be pulled because the shelf count is lower than what was reserved. Recount it, then pull again."
    : `${short} lines could not be pulled because the shelf count is lower than what was reserved. Recount them, then pull again.`;
}

/** Pull a whole job (or one line) from the shop to its pallet. */
export function PullButton({ jobId, lineId, label, disabled }: { jobId: string; lineId?: string; label: string; disabled?: boolean }) {
  const { run, pending, error } = useInventoryMutation();
  const [notice, setNotice] = useState<string | null>(null);

  async function pull() {
    setNotice(null);
    const result = await run(`/api/jobs/${encodeURIComponent(jobId)}/pull`, "POST", lineId ? { lineId } : undefined);
    if (result.ok) setNotice(pullMessage(result.data));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant={lineId ? "ghost" : "primary"} disabled={pending || disabled} onClick={() => void pull()}>
        {pending ? "Pulling…" : label}
      </Button>
      <FormError message={error} />
      <FormWarning message={notice} />
    </div>
  );
}

/** A cancelled job's pallet goes back to the shop. */
export function ReturnPalletButton({ jobId }: { jobId: string }) {
  const { run, pending, error } = useInventoryMutation();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => void run(`/api/jobs/${encodeURIComponent(jobId)}/return-pallet`, "POST", { note: "Job cancelled" })}
      >
        {pending ? "Returning…" : "Return pallet to shop"}
      </Button>
      <FormError message={error} />
    </div>
  );
}

export function PullListLink({ jobId }: { jobId: string }) {
  return (
    <Link
      href={ROUTE_BUILDERS.JOB_PULL_LIST(jobId)}
      className="inline-flex min-h-9 items-center gap-1 rounded-atlas-md px-2 text-xs text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      <Printer size={14} aria-hidden="true" />
      Pull list
    </Link>
  );
}

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" />
      Print
    </Button>
  );
}

/** Warehouse flag: this part was missing from the shelf, or is not needed on this kind of job. */
export function LineFlagButton({ jobId, lineId, itemId, lineName }: { jobId: string; lineId: string; itemId: string; lineName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Flag ${lineName}`}>
        <Flag size={14} aria-hidden="true" />
        Flag
      </Button>
      {open ? <FlagForm jobId={jobId} lineId={lineId} itemId={itemId} lineName={lineName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function FlagForm({ jobId, lineId, itemId, lineName, onClose }: { jobId: string; lineId: string; itemId: string; lineName: string; onClose: () => void }) {
  const { run, pending, error } = useInventoryMutation();
  const [kind, setKind] = useState<"missing_part" | "kit_feedback">("missing_part");
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    const result = await run(`/api/jobs/${encodeURIComponent(jobId)}/material-events`, "POST", {
      eventType: kind,
      lineId,
      itemId,
      note: kind === "kit_feedback" ? `Not needed${text ? `: ${text}` : ""}` : text || undefined,
    });
    if (result.ok) onClose();
  }

  return (
    <DialogShell title="Flag this line" description={lineName} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="What is wrong?" htmlFor="flag-kind">
          <select id="flag-kind" value={kind} onChange={(e) => setKind(e.target.value as "missing_part" | "kit_feedback")} className={fieldClass}>
            <option value="missing_part">Missing from the shelf</option>
            <option value="kit_feedback">Not needed for this kind of job</option>
          </select>
        </FormField>
        <FormField label="Note (optional)" htmlFor="flag-note">
          <input id="flag-note" value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} maxLength={500} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save flag"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
