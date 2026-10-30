import type { JobActivity } from "@/features/jobs/types/jobActivity";
import type { JobNote } from "@/features/jobs/types/jobNote";
import { companyTimeZone } from "@/lib/timezone";

/** Toast and timeline title for a note save. Distinct from the QA checklist. */
export const JOB_NOTE_ACTIVITY_TITLE = "Note added";
export const JOB_NOTE_SAVED_TOAST = "Note added.";

export const EARLIER_NOTE_AUTHOR = "Earlier note";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  dispatch: "Dispatch",
  tech: "Technician",
  office: "Office",
  sales: "Sales",
};

export function jobNoteRoleLabel(role: string | null | undefined): string {
  const key = role?.trim().toLowerCase() ?? "";
  if (!key) return "";
  return ROLE_LABELS[key] ?? role?.trim() ?? "";
}

/**
 * The jobs.notes column is still shown when it is not already a history row.
 * That covers the window before the backfill and a technician's first note,
 * which must not be inserted as if the tech wrote the earlier text.
 */
export function legacyNoteFallback(historyBodies: string[], column: string): string | null {
  const text = column.trim();
  if (!text) return null;
  if (historyBodies.some((body) => body.trim() === text)) return null;
  return text;
}

export function sortJobNotesNewestFirst<T extends { createdAt: string; id: string }>(
  notes: T[],
): T[] {
  return [...notes].sort((left, right) => {
    const delta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (delta !== 0 && !Number.isNaN(delta)) return delta;
    return right.id.localeCompare(left.id);
  });
}

/**
 * Bodies to insert, oldest first.
 * The single jobs.notes column is copied in as the first history row when
 * no history exists yet and the new text is different, so that text is not lost.
 * A matching column with an empty history becomes the one history row.
 * Later saves append only the new text.
 */
export function noteBodiesToAppend(input: {
  existingColumn: string;
  historyCount: number;
  incoming: string;
}): string[] {
  const incoming = input.incoming.trim();
  if (!incoming) return [];

  const existing = input.existingColumn.trim();
  if (input.historyCount === 0 && existing && existing !== incoming) {
    return [existing, incoming];
  }

  return [incoming];
}

export interface DisplayJobNote extends JobNote {
  /** Copied from the old single notes field. Shown as an earlier note, not a new save. */
  imported: boolean;
}

const PLACEHOLDER_NOTE_DESCRIPTIONS = new Set(["Job notes updated.", "Notes updated."]);

/**
 * History for the job page, newest first.
 * The row copied from jobs.notes is the oldest entry whose text still matches
 * that column. It stays in the list and is marked imported so the card can
 * label it as an earlier note instead of dropping it.
 * If the column text is not in history yet, it is added as an earlier note.
 */
export function displayJobNotes(notes: JobNote[] | null | undefined, column: string): DisplayJobNote[] {
  const rows = notes ?? [];
  const columnText = column.trim();
  const oldestMatch = [...rows]
    .filter((note) => columnText && note.body.trim() === columnText)
    .sort((left, right) => {
      const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (delta !== 0 && !Number.isNaN(delta)) return delta;
      return left.id.localeCompare(right.id);
    })[0];

  const history = sortJobNotesNewestFirst(rows).map((note) => ({
    ...note,
    imported: oldestMatch?.id === note.id,
  }));

  if (columnText && !history.some((note) => note.body.trim() === columnText)) {
    history.push({
      id: "legacy-column-note",
      jobId: rows[0]?.jobId ?? "",
      body: columnText,
      authorId: null,
      authorName: EARLIER_NOTE_AUTHOR,
      authorRole: "",
      createdAt: "",
      imported: true,
    });
  }

  return history;
}

export function jobNoteByline(note: DisplayJobNote): string {
  const when = formatJobNoteTimestamp(note.createdAt);
  if (note.imported) {
    return ["Earlier note", when].filter(Boolean).join(" · ");
  }
  const role = jobNoteRoleLabel(note.authorRole);
  return [note.authorName.trim(), role, when].filter(Boolean).join(" · ");
}

function activityAlreadyShowsNote(activity: JobActivity[], body: string): boolean {
  const text = body.trim();
  if (!text) return false;
  return activity.some(
    (item) =>
      item.type === "note" &&
      !PLACEHOLDER_NOTE_DESCRIPTIONS.has(item.description.trim()) &&
      item.description.includes(text),
  );
}

/**
 * Put imported notes on the activity timeline. Older saves only stored
 * "Job notes updated." with no text. When a history row lines up with one of
 * those placeholders, the placeholder keeps its time and gains the note text.
 * Notes already written as "Note added" are left as they are.
 */
export function activityWithJobNotes(activity: JobActivity[], notes: DisplayJobNote[]): JobActivity[] {
  const next = activity.map((item) => ({ ...item }));

  for (const note of [...notes].reverse()) {
    if (activityAlreadyShowsNote(next, note.body)) continue;

    const noteTime = note.createdAt ? new Date(note.createdAt).getTime() : Number.NaN;
    const placeholder = next.find((item) => {
      if (item.type !== "note" || !PLACEHOLDER_NOTE_DESCRIPTIONS.has(item.description.trim())) {
        return false;
      }
      if (Number.isNaN(noteTime)) return false;
      return Math.abs(new Date(item.timestamp).getTime() - noteTime) < 5000;
    });

    const title = note.imported ? "Earlier note" : JOB_NOTE_ACTIVITY_TITLE;
    const description = note.body.trim();
    if (!description) continue;

    if (placeholder) {
      placeholder.title = title;
      placeholder.description = description;
      continue;
    }

    next.push({
      id: `note-history-${note.id}`,
      jobId: note.jobId,
      type: "note",
      title,
      description,
      timestamp: note.createdAt || new Date(0).toISOString(),
    });
  }

  return next;
}

export function formatJobNoteTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: companyTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
