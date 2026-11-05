import type { JobFollowUpState } from "../types/followUp";

export const FOLLOW_UP_NOTE_MAX = 500;

export interface FollowUpColumns {
  follow_up_needed: boolean;
  follow_up_note: string | null;
  follow_up_marked_at: string | null;
  follow_up_marked_by: string | null;
}

/** Trim, cap, and turn an empty note into null. */
export function normalizeFollowUpNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim().slice(0, FOLLOW_UP_NOTE_MAX);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Columns to write when a job's follow-up flag changes.
 *  - Marking stamps who/when.
 *  - Re-saving a note on an already-flagged job keeps the original stamp.
 *  - Unmarking clears the note and the stamp.
 */
export function buildFollowUpPatch(
  input: { needed: boolean; note?: unknown; userId: string | null; now: Date },
  existing: Pick<JobFollowUpState, "needed" | "markedAt" | "markedBy"> | null,
): FollowUpColumns {
  if (!input.needed) {
    return {
      follow_up_needed: false,
      follow_up_note: null,
      follow_up_marked_at: null,
      follow_up_marked_by: null,
    };
  }
  const alreadyMarked = existing?.needed === true;
  return {
    follow_up_needed: true,
    follow_up_note: normalizeFollowUpNote(input.note),
    follow_up_marked_at: alreadyMarked && existing?.markedAt ? existing.markedAt : input.now.toISOString(),
    follow_up_marked_by: alreadyMarked ? (existing?.markedBy ?? input.userId) : input.userId,
  };
}
