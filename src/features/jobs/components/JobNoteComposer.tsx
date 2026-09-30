"use client";

import { useState } from "react";
import { FileText, Save } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

export function JobNoteComposer({
  notes,
  onSaveNotes,
}: {
  notes: string;
  onSaveNotes: (notes: string) => Promise<void> | void;
}) {
  const [note, setNote] = useState(notes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    const value = note.trim();

    if (!value) {
      setError("Notes are required before saving.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setIsSaving(true);
      await onSaveNotes(value);
      setSuccess("Notes saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save notes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
            <FileText className="h-5 w-5 text-red-300" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">Add Note</h2>
            <p className="mt-1 text-sm text-slate-400">
              Capture field updates, customer communication, or internal
              execution notes.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Capture job notes, field updates, and closeout details..."
            // F14: text-base on phones prevents iOS auto-zoom on focus.
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40 md:text-sm"
          />

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {success}
            </p>
          ) : null}

          {/* F14: full-width thumb target on phones. */}
          <div className="md:flex md:justify-end">
            <Button
              onClick={() => void handleSubmit()}
              className="min-h-[48px] w-full gap-2 text-base md:w-auto md:min-h-0 md:text-sm"
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
