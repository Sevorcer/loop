/**
 * The serial list the edit form saves: the typed first serial, followed by the system's
 * other serials unchanged. Clearing the field removes only the first serial. Repeats
 * (compared ignoring case) are dropped.
 */
export function serialListForSave(typedFirst: string, existing: readonly string[] | undefined): string[] {
  const candidates = [typedFirst.trim(), ...(existing ?? []).slice(1).map((serial) => serial.trim())];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const serial of candidates) {
    const key = serial.toLowerCase();
    if (!serial || seen.has(key)) continue;
    seen.add(key);
    list.push(serial);
  }
  return list;
}
