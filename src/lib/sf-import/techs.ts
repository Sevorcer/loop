export interface LoopProfile {
  id: string;
  fullName: string;
}

export interface TechRef {
  sfId: number | null;
  name: string;
}

export interface MatchedTech {
  sfId: number | null;
  userId: string;
  fullName: string;
}

export interface UnmatchedTech {
  name: string;
  ambiguous: boolean;
}

/** Case-insensitive first and last name, with punctuation ignored. */
export function normalizePersonName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function personName(first: string, last: string): string {
  return `${first} ${last}`.replace(/\s+/g, " ").trim();
}

/**
 * Match Service Fusion technicians to people who already log in to Loop.
 * Two Loop people with the same name are left unmatched so the wrong person
 * is not assigned. Nothing here creates a login.
 */
export function matchTechNames(
  techs: readonly TechRef[],
  profiles: readonly LoopProfile[],
): { matched: MatchedTech[]; unmatched: UnmatchedTech[] } {
  const byName = new Map<string, LoopProfile[]>();
  for (const profile of profiles) {
    const key = normalizePersonName(profile.fullName);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(profile);
    byName.set(key, list);
  }

  const matched: MatchedTech[] = [];
  const unmatched: UnmatchedTech[] = [];
  const seenUsers = new Set<string>();
  const seenUnmatched = new Set<string>();

  for (const tech of techs) {
    const display = tech.name.trim();
    const key = normalizePersonName(display);
    if (!key) continue;
    const found = byName.get(key) ?? [];
    if (found.length === 1) {
      if (seenUsers.has(found[0].id)) continue;
      seenUsers.add(found[0].id);
      matched.push({
        sfId: tech.sfId,
        userId: found[0].id,
        fullName: found[0].fullName,
      });
      continue;
    }

    const unmatchedKey = `${key}|${found.length > 1}`;
    if (seenUnmatched.has(unmatchedKey)) continue;
    seenUnmatched.add(unmatchedKey);
    unmatched.push({ name: display, ambiguous: found.length > 1 });
  }

  return { matched, unmatched };
}
