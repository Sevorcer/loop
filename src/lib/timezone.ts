/**
 * Company timezone for scheduling.
 *
 * LOOP stores appointment instants as UTC timestamptz values and groups them
 * by the company's wall-clock day. Legacy One Heating operates in Pacific
 * time. Override with NEXT_PUBLIC_COMPANY_TIME_ZONE when another company
 * needs a different zone. The value must be an IANA timezone name so both
 * the server (UTC) and browsers agree.
 */

export const DEFAULT_COMPANY_TIME_ZONE = "America/Los_Angeles";

export function companyTimeZone(): string {
  const configured = process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE?.trim();
  return configured || DEFAULT_COMPANY_TIME_ZONE;
}

function formatPart(
  instant: Date,
  timeZone: string,
  type: Intl.DateTimeFormatPartTypes,
): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .find((entry) => entry.type === type);
  return part?.value ?? "";
}

/** Offset of `timeZone` at `instant`, in milliseconds (local wall clock minus UTC). */
export function timeZoneOffsetMs(instant: Date, timeZone = companyTimeZone()): number {
  const year = Number(formatPart(instant, timeZone, "year"));
  const month = Number(formatPart(instant, timeZone, "month"));
  const day = Number(formatPart(instant, timeZone, "day"));
  let hour = Number(formatPart(instant, timeZone, "hour"));
  const minute = Number(formatPart(instant, timeZone, "minute"));
  const second = Number(formatPart(instant, timeZone, "second"));
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - instant.getTime();
}

/**
 * Calendar date (YYYY-MM-DD) of an instant or date-only string in the company timezone.
 * Date-only strings are returned unchanged so they are not shifted across midnight.
 */
export function companyCalendarDate(
  value: string | null | undefined,
  timeZone = companyTimeZone(),
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  const year = formatPart(date, timeZone, "year");
  const month = formatPart(date, timeZone, "month");
  const day = formatPart(date, timeZone, "day");
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function todayInCompanyTimeZone(now = new Date(), timeZone = companyTimeZone()): string {
  return companyCalendarDate(now.toISOString(), timeZone) ?? "";
}

/** Convert a company-timezone wall clock to a UTC ISO instant. */
export function zonedWallTimeToUtcIso(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  timeZone?: string;
}): string | null {
  const timeZone = input.timeZone ?? companyTimeZone();
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second ?? 0,
  );
  let utc = utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone);
  utc = utcGuess - timeZoneOffsetMs(new Date(utc), timeZone);
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** "YYYY-MM-DDTHH:mm" wall clock in the company timezone. */
export function utcIsoToCompanyDateTimeLocal(
  isoValue: string | null | undefined,
  timeZone = companyTimeZone(),
): string {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = formatPart(date, timeZone, "year");
  const month = formatPart(date, timeZone, "month");
  const day = formatPart(date, timeZone, "day");
  let hour = formatPart(date, timeZone, "hour");
  const minute = formatPart(date, timeZone, "minute");
  if (hour === "24") hour = "00";
  if (!year || !month || !day || hour === "" || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** HH:mm wall clock in the company timezone. */
export function companyTimeOfDay(
  isoValue: string | null | undefined,
  timeZone = companyTimeZone(),
): string | null {
  const local = utcIsoToCompanyDateTimeLocal(isoValue, timeZone);
  const match = /T(\d{2}:\d{2})$/.exec(local);
  return match?.[1] ?? null;
}

/**
 * Keep the company-timezone wall clock and move it onto `companyDate` (YYYY-MM-DD).
 */
export function shiftIsoToCompanyDate(
  isoValue: string | null | undefined,
  companyDate: string,
  timeZone = companyTimeZone(),
): string | null {
  if (!isoValue || !/^\d{4}-\d{2}-\d{2}$/.test(companyDate)) return null;
  const time = companyTimeOfDay(isoValue, timeZone);
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  const [year, month, day] = companyDate.split("-").map(Number);
  return zonedWallTimeToUtcIso({ year, month, day, hour, minute, timeZone });
}

export function hoursBetweenIso(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round((ms / 3_600_000) * 10) / 10;
}

/** Add calendar days to a YYYY-MM-DD string. Arithmetic is date-only, not an instant. */
export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}
