/**
 * A job's people are one team. Reports, the calendar, and the job page
 * show them together as "Brian Ramirez + Sean Ryan".
 */

export function splitTeamNames(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\s*(?:\+|,)\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function formatTeamLabel(names: readonly string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  unique.sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
  return unique.join(" + ");
}
