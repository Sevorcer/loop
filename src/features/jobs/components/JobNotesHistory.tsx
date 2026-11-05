"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import type { JobActivity } from "@/features/jobs/types/jobActivity";
import type { JobNote } from "@/features/jobs/types/jobNote";
import { displayJobNotes, jobNoteByline } from "@/features/jobs/utils/jobNotes";
import { requestJson } from "@/lib/api/client";

const NOTE_EDIT_ROLES = new Set([
  "owner",
  "manager",
  "dispatch",
  "office",
  "sales",
  "tech",
]);

export function JobNotesHistory({
  jobId,
  notes,
  legacyNotes,
  activity,
  onNoteUpdated,
}: {
  jobId?: string;
  notes?: JobNote[] | null;
  legacyNotes?: string;
  activity?: JobActivity[] | null;
  onNoteUpdated?: (note: JobNote) => void;
}) {
  const { role } = useCurrentRole();
  const canEdit = NOTE_EDIT_ROLES.has(role ?? "");
  const history = displayJobNotes(notes, legacyNotes ?? "", activity);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <p className="mt-2 text-sm leading-6 text-muted">
        No notes have been captured for this job yet.
      </p>
    );
  }

  async function saveEdit(noteId: string) {
    if (!role || !jobId) return;
    const body = draft.trim();
    if (!body) {
      setError("Write a note before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await requestJson<{ note: JobNote }>(
        `/api/jobs/${jobId}/notes/${noteId}`,
        { role, method: "PATCH", body: { body } },
      );
      onNoteUpdated?.(response.note);
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      {history.map((note) => {
        const editable = canEdit && jobId && !note.id.startsWith("legacy-");
        return (
          <article key={note.id} className="rounded-2xl border border-default bg-surface-elevated p-4">
            {editingId === note.id ? (
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500/40"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void saveEdit(note.id)}
                    disabled={saving || !draft.trim()}
                  >
                    {saving ? "Saving…" : "Save note"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {note.body}
                  </p>
                  {editable ? (
                    <button
                      type="button"
                      aria-label="Edit note"
                      onClick={() => {
                        setEditingId(note.id);
                        setDraft(note.body);
                        setError(null);
                      }}
                      className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted">{jobNoteByline(note)}</p>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
