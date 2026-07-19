"use client";

import { useState } from "react";
import { FileText, PlusCircle } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

export function JobNoteComposer({
  onAddNote,
}: {
  onAddNote: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  function handleSubmit() {
    const value = note.trim();

    if (!value) {
      return;
    }

    onAddNote(value);
    setNote("");
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
            placeholder="Type a job note..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
          />

          <div className="flex justify-end">
            <Button onClick={handleSubmit} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Note
            </Button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}