import type { JobNote } from "@/features/jobs/types/jobNote";
import { displayJobNotes, jobNoteByline } from "@/features/jobs/utils/jobNotes";

export function JobNotesHistory({
  notes,
  legacyNotes,
}: {
  notes?: JobNote[] | null;
  legacyNotes?: string;
}) {
  const history = displayJobNotes(notes, legacyNotes ?? "");

  if (history.length === 0) {
    return (
      <p className="mt-2 text-sm leading-6 text-muted">
        No notes have been captured for this job yet.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {history.map((note) => (
        <article key={note.id} className="rounded-2xl border border-default bg-surface-elevated p-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{note.body}</p>
          <p className="mt-2 text-xs text-muted">{jobNoteByline(note)}</p>
        </article>
      ))}
    </div>
  );
}
