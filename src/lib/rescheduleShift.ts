/**
 * Shared day-delta shift math for drag-to-reschedule on both the dispatch
 * board and the month calendar.
 *
 * The function computes shifted scheduledStartAt / scheduledEndAt values by
 * moving both instants forward or backward by the number of calendar days
 * between the grab day and the drop day (in the company timezone). The
 * time-of-day component of each instant is preserved so a job that starts at
 * 09:00 and ends at 17:00 keeps those wall-clock times after the shift.
 */

import {
  companyCalendarDate,
  companyTimeZone,
  shiftIsoToCompanyDate,
  addCalendarDays,
} from "./timezone";

export interface RescheduleShiftInput {
  /** Current scheduledStartAt — ISO 8601 timestamptz. */
  scheduledStartAt: string;
  /** Current scheduledEndAt — ISO 8601 timestamptz, or null for single-day jobs without an end. */
  scheduledEndAt: string | null;
  /** The calendar day the user grabbed (YYYY-MM-DD, company timezone). */
  grabDay: string;
  /** The calendar day the user dropped onto (YYYY-MM-DD, company timezone). */
  dropDay: string;
}

export interface RescheduleShiftResult {
  scheduledStartAt: string;
  scheduledEndAt: string | null;
}

/**
 * Compute the number of calendar days between two YYYY-MM-DD strings.
 * Positive when `to` is after `from`.
 */
function calendarDayDelta(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Shift a job's start and end instants by the calendar-day delta between
 * `grabDay` and `dropDay`. The time-of-day is preserved for each instant.
 *
 * When `dropDay === grabDay` the original values are returned unchanged.
 * When `scheduledEndAt` is null it stays null.
 */
export function computeRescheduleShift(
  input: RescheduleShiftInput,
): RescheduleShiftResult {
  const { scheduledStartAt, scheduledEndAt, grabDay, dropDay } = input;
  const tz = companyTimeZone();

  const delta = calendarDayDelta(grabDay, dropDay);

  if (delta === 0) {
    return { scheduledStartAt, scheduledEndAt };
  }

  // Compute the company-timezone calendar date for each instant, shift by
  // delta days, then place the original wall-clock time onto the new date.
  const startDate = companyCalendarDate(scheduledStartAt, tz);
  if (!startDate) {
    return { scheduledStartAt, scheduledEndAt };
  }
  const newStartDate = addCalendarDays(startDate, delta);
  const newStart = shiftIsoToCompanyDate(scheduledStartAt, newStartDate, tz);

  let newEnd: string | null = null;
  if (scheduledEndAt) {
    const endDate = companyCalendarDate(scheduledEndAt, tz);
    if (endDate) {
      const newEndDate = addCalendarDays(endDate, delta);
      newEnd = shiftIsoToCompanyDate(scheduledEndAt, newEndDate, tz);
    }
  }

  return {
    scheduledStartAt: newStart ?? scheduledStartAt,
    scheduledEndAt: newEnd,
  };
}
