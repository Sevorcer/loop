"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ModalDialog } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { useMaterialPlan } from "../../state/MaterialPlanProvider";
import { PlanError, PlanField } from "./PlanFormParts";
import { planFieldClass } from "./planStyles";

/** Turn this job's catalog-linked materials into a reusable kit. */
export function SaveAsKitDialog({ onClose }: { onClose: () => void }) {
  const { saveAsKit, busy } = useMaterialPlan();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ kitId?: string; skipped: number } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the kit a name.");
    setError(null);
    const result = await saveAsKit(name.trim());
    if (!result.ok) return setError(result.message ?? "Could not save the kit.");
    setSaved({ kitId: result.kitId, skipped: result.skippedUnlinked ?? 0 });
  }

  return (
    <ModalDialog
      title="Save as a kit"
      description="Copies this job’s catalog-linked materials into a new kit you can reuse."
      onClose={onClose}
    >
      {saved ? (
        <div className="space-y-4">
          <p role="status" className="status-success rounded-atlas-md px-3 py-2 text-sm">
            Kit saved.
            {saved.skipped > 0
              ? ` ${saved.skipped} line${saved.skipped === 1 ? " was" : "s were"} left out because ${saved.skipped === 1 ? "it is" : "they are"} not linked to a catalog item.`
              : ""}
          </p>
          <div className="flex justify-end gap-2">
            {saved.kitId ? (
              <Link href={ROUTE_BUILDERS.INVENTORY_KIT(saved.kitId)} className="inline-flex h-10 items-center rounded-atlas-md px-4 text-sm font-medium text-primary underline underline-offset-4">
                Open the kit
              </Link>
            ) : null}
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <PlanError message={error} />
          <PlanField label="Kit name" htmlFor="save-kit-name" hint="For example, Gas furnace swap (condensing).">
            <input id="save-kit-name" value={name} onChange={(event) => setName(event.target.value)} className={planFieldClass} maxLength={120} />
          </PlanField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save kit"}
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
