import type { JobNote } from "@/features/jobs/types/jobNote";
import {
  formatJobNoteTimestamp,
  jobNoteRoleLabel,
  legacyNoteFallback,
  sortJobNotesNewestFirst,
} from "@/features/jobs/utils/jobNotes";

export function JobNotesHistory({
  notes,
  legacyNotes,
}: {
  notes: JobNote[];
  legacyNotes?: string;
}) {
  const history = sortJobNotesNewestFirst(notes);
  const fallback = legacyNoteFallback(
    history.map((note) => note.body),
    legacyNotes ?? "",
  );

  if (history.length === 0 && !fallback) {
    return (
      <p className="mt-2 text-sm leading-6 text-slate-400">
        No notes have been captured for this job yet.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {history.map((note) => {
        const role = jobNoteRoleLabel(note.authorRole);
        const when = formatJobNoteTimestamp(note.createdAt);
        const byline = [note.authorName.trim(), role, when].filter(Boolean).join(" · ");
        return (
          <article key={note.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{note.body}</p>
            {byline ? <p className="mt-2 text-xs text-slate-500">{byline}</p> : null}
          </article>
        );
      })}
      {fallback ? (
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{fallback}</p>
          <p className="mt-2 text-xs text-slate-500">Earlier note</p>
        </article>
      ) : null}
    </div>
  );
}
