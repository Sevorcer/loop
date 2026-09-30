/**
 * Shared date helpers that are immune to UTC/local timezone day-shifts.
 */

/**
 * Today's calendar date as "YYYY-MM-DD" in the runtime's local timezone.
 * Use for date inputs, min attributes, and client-side "today" comparisons —
 * `new Date().toISOString().slice(0, 10)` returns the UTC date, which is a
 * different calendar day for several hours each evening in behind-UTC zones.
 */
export function todayLocalISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Date-only values ("YYYY-MM-DD", e.g. scheduled_for, install_date) carry no
 * time or timezone information. Parsing them with `new Date("2026-09-30")`
 * yields UTC midnight, and formatting that in a behind-UTC timezone (like
 * America/Los_Angeles) renders the PREVIOUS day. This helper formats the
 * calendar date the value actually represents, immune to that shift.
 */

/**
 * Formats a date-only string ("YYYY-MM-DD") or ISO timestamp for display as a
 * calendar date (e.g. "Sep 30, 2026").
 *
 * - Date-only strings are parsed by components (no UTC-midnight shift).
 * - Full ISO timestamps fall back to normal local formatting.
 * - Returns "" for null/undefined/empty/invalid input.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const probe = new Date(y, m - 1, d);
    if (
      Number.isNaN(probe.getTime()) ||
      probe.getFullYear() !== y ||
      probe.getMonth() !== m - 1 ||
      probe.getDate() !== d
    ) {
      return "";
    }
    return probe.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
