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
    const delta = parseInstant(right.createdAt) - parseInstant(left.createdAt);
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
const LEGACY_PLACEHOLDER_TITLE = "Notes updated";
/** Old saves within this window of a copied note are the same edit. */
const LEGACY_NOTE_MATCH_WINDOW_MS = 5000;

/**
 * Timeline copy when a legacy "Notes updated" event has no surviving note.
 * The text was overwritten before history existed and cannot be recovered.
 */
export const LEGACY_NOTE_UNSAVED_TEXT = "Notes edited (earlier text not saved)";

/**
 * Parse a timestamptz from Postgres or PostgREST.
 * Values with more than 3 fractional digits, or a short "+00" offset, are
 * invalid in some engines. Normalize those before giving up.
 */
function parseInstant(value: string): number {
  if (!value) return Number.NaN;
  const direct = new Date(value).getTime();
  if (!Number.isNaN(direct)) return direct;
  const normalized = value
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2})[ T]/, "$1T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/\+00$/, "Z");
  return new Date(normalized).getTime();
}

function sameJob(leftId: string, rightId: string): boolean {
  if (!leftId || !rightId) return true;
  return leftId === rightId;
}

function isLegacyPlaceholder(item: JobActivity): boolean {
  if (item.type !== "note") return false;
  const description = item.description.trim();
  return (
    item.title.trim() === LEGACY_PLACEHOLDER_TITLE ||
    PLACEHOLDER_NOTE_DESCRIPTIONS.has(description)
  );
}

/**
 * The backfill copied jobs.notes and set created_at to the latest note
 * activity's timestamp (exact match, not "a few seconds later"). New saves
 * insert the note first and write activity just after, so they do not line
 * up with a "Notes updated" placeholder.
 */
function legacyPlaceholderMatches(activity: JobActivity[] | null | undefined, notes: JobNote[]): Map<string, JobNote> {
  const pairs: { activityId: string; note: JobNote; delta: number }[] = [];
  for (const item of activity ?? []) {
    if (!isLegacyPlaceholder(item)) continue;
    const itemTime = parseInstant(item.timestamp);
    if (Number.isNaN(itemTime)) continue;
    for (const note of notes) {
      if (!note.body.trim() || !sameJob(note.jobId, item.jobId)) continue;
      const noteTime = parseInstant(note.createdAt);
      if (Number.isNaN(noteTime)) continue;
      const delta = Math.abs(itemTime - noteTime);
      if (delta < LEGACY_NOTE_MATCH_WINDOW_MS) {
        pairs.push({ activityId: item.id, note, delta });
      }
    }
  }

  pairs.sort((left, right) => left.delta - right.delta || left.note.id.localeCompare(right.note.id));
  const usedActivity = new Set<string>();
  const usedNotes = new Set<string>();
  const matches = new Map<string, JobNote>();
  for (const pair of pairs) {
    if (usedActivity.has(pair.activityId) || usedNotes.has(pair.note.id)) continue;
    usedActivity.add(pair.activityId);
    usedNotes.add(pair.note.id);
    matches.set(pair.activityId, pair.note);
  }
  return matches;
}

function compareOldest(left: { createdAt: string; id: string }, right: { createdAt: string; id: string }): number {
  const delta = parseInstant(left.createdAt) - parseInstant(right.createdAt);
  if (delta !== 0 && !Number.isNaN(delta)) return delta;
  return left.id.localeCompare(right.id);
}

/**
 * History for the job page, newest first.
 * A row is an earlier note when the migration named it "Earlier note", or
 * when its time matches a legacy "Notes updated" placeholder. Matching the
 * current jobs.notes text is only a fallback: a later edit can overwrite
 * that column, and the migration stored the last editor's real name.
 * If the column text is not in history yet, it is added as an earlier note.
 */
export function displayJobNotes(
  notes: JobNote[] | null | undefined,
  column: string,
  activity?: JobActivity[] | null,
): DisplayJobNote[] {
  const rows = notes ?? [];
  const columnText = column.trim();
  const timedIds = new Set(
    [...legacyPlaceholderMatches(activity, rows).values()].map((note) => note.id),
  );
  const hasLegacyPlaceholder = (activity ?? []).some(isLegacyPlaceholder);
  const columnFallback =
    activity == null || (timedIds.size === 0 && hasLegacyPlaceholder);
  const oldestColumnMatch = columnFallback
    ? [...rows].filter((note) => columnText && note.body.trim() === columnText).sort(compareOldest)[0]
    : undefined;

  const history = sortJobNotesNewestFirst(rows).map((note) => ({
    ...note,
    imported:
      note.authorName.trim() === EARLIER_NOTE_AUTHOR ||
      timedIds.has(note.id) ||
      oldestColumnMatch?.id === note.id,
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
  return activity.some((item) => {
    if (item.type !== "note" || isLegacyPlaceholder(item)) return false;
    return item.description.split("\n").some((line) => line.trim() === text);
  });
}

/**
 * Fill legacy "Notes updated" timeline rows from note history.
 * A placeholder whose time matches a job_notes row keeps that time and shows
 * the note text. A placeholder with no row shows that the earlier text was
 * not saved. "Note added" events already contain their text and stay as they are.
 */
export function activityWithJobNotes(activity: JobActivity[], notes: DisplayJobNote[]): JobActivity[] {
  const next = activity.map((item) => ({ ...item }));
  const matches = legacyPlaceholderMatches(next, notes);
  const usedNoteIds = new Set([...matches.values()].map((note) => note.id));
  const placeholderIds = new Set(next.filter(isLegacyPlaceholder).map((item) => item.id));

  for (const item of next) {
    if (!placeholderIds.has(item.id)) continue;
    const match = matches.get(item.id);
    const description = match?.body.trim() ?? "";
    if (match && description) {
      const display = notes.find((note) => note.id === match.id);
      item.title = display?.imported ? "Earlier note" : JOB_NOTE_ACTIVITY_TITLE;
      item.description = description;
      continue;
    }
    item.title = "Notes edited";
    item.description = LEGACY_NOTE_UNSAVED_TEXT;
  }

  for (const note of [...notes].reverse()) {
    if (usedNoteIds.has(note.id) || activityAlreadyShowsNote(next, note.body)) continue;
    const description = note.body.trim();
    if (!description) continue;
    next.push({
      id: `note-history-${note.id}`,
      jobId: note.jobId,
      type: "note",
      title: note.imported ? "Earlier note" : JOB_NOTE_ACTIVITY_TITLE,
      description,
      timestamp: note.createdAt || new Date(0).toISOString(),
    });
  }

  return next;
}

export function formatJobNoteTimestamp(iso: string): string {
  const time = parseInstant(iso);
  if (!iso || Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: companyTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
}
