// ============================================================
// Dispatch — Crew Conflict Detection
// Sprint 6
//
// Detects overlapping crew schedule blocks for a given set of blocks.
// Two blocks conflict when they share the same crew and date, and their
// time ranges overlap.
// ============================================================

import type { ScheduleBlock } from "../types/dispatch";

/**
 * Converts a 24-hour time string (e.g. "08:30") to total minutes from midnight.
 */
function parseTimeToMinutes(time24: string): number {
  const [hourStr, minuteStr] = time24.split(":");
  return parseInt(hourStr, 10) * 60 + parseInt(minuteStr ?? "0", 10);
}

/**
 * Returns the IDs of all schedule blocks that overlap with another block
 * belonging to the same crew on the same day.
 *
 * Two blocks are considered conflicting if they share the same `crewName` and
 * `scheduledDate`, and their time ranges overlap (touching at a single point
 * is NOT a conflict).
 */
export function detectCrewConflicts(blocks: ScheduleBlock[]): Set<string> {
  const conflictIds = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];

      if (a.crewName !== b.crewName || a.scheduledDate !== b.scheduledDate) {
        continue;
      }

      const aStart = parseTimeToMinutes(a.scheduledStartTime);
      const aEnd = parseTimeToMinutes(a.scheduledEndTime);
      const bStart = parseTimeToMinutes(b.scheduledStartTime);
      const bEnd = parseTimeToMinutes(b.scheduledEndTime);

      // Strict overlap: ranges must share more than a single endpoint
      if (aStart < bEnd && bStart < aEnd) {
        conflictIds.add(a.id);
        conflictIds.add(b.id);
      }
    }
  }

  return conflictIds;
}

/**
 * Returns true when the given block ID is part of a conflict set.
 */
export function isBlockConflicting(
  blockId: string,
  conflictIds: Set<string>,
): boolean {
  return conflictIds.has(blockId);
}
