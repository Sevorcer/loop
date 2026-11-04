import { formatDateOnly } from "@/lib/dates";
import { companyCalendarDate, todayInCompanyTimeZone } from "@/lib/timezone";

/**
 * The multi-day completion block (B1): a job that spans several scheduled
 * days cannot be completed before its final scheduled day. Day boundaries are
 * the company timezone (America/Los_Angeles), matching how dispatch windowing
 * counts calendar days and how the DB gate (guard_job_completion_gate) reads
 * the scheduled dates. The final day is the scheduled end; a job with no end
 * falls back to its start day. Single-day jobs (no end, or an end on the start
 * day) are never gated, so this applies equally to full and visit closeout.
 *
 * Returns the blocker sentence (the detail of the completion refusal) while
 * the block stands, or null when the job may be completed today. Pure and
 * client-safe: the completion path, the completion-checklist payload, and the
 * job page's checklist card all use this one implementation.
 */
export function finalScheduledDayBlocker(
  job: { scheduledStartAt?: string | null; scheduledEndAt?: string | null },
  today: string = todayInCompanyTimeZone(),
): string | null {
  const startDay = companyCalendarDate(job.scheduledStartAt);
  const endDay = companyCalendarDate(job.scheduledEndAt);
  const finalDay = endDay ?? startDay;
  if (startDay && finalDay && finalDay > startDay && today < finalDay) {
    return `this job runs through ${formatDateOnly(finalDay)} and cannot be completed before its final scheduled day`;
  }
  return null;
}
