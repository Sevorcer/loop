import { companyTimeZone } from "@/lib/timezone";

/** "Nov 5" in the company timezone; "" when the value is missing or invalid. */
export function formatFollowUpDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: companyTimeZone(),
  }).format(date);
}

/** "Marked Nov 5 by Allison", degrading gracefully when either part is unknown. */
export function formatFollowUpMarker(
  markedAt: string | null | undefined,
  markedByName: string | null | undefined,
): string {
  const date = formatFollowUpDate(markedAt);
  const who = markedByName?.trim();
  if (date && who) return `Marked ${date} by ${who}`;
  if (date) return `Marked ${date}`;
  if (who) return `Marked by ${who}`;
  return "";
}
