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
