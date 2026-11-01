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
  /** The Service Fusion name that was matched. */
  sfName: string;
  /** True when a saved alias pointed this Service Fusion name at the Loop person. */
  aliased: boolean;
}

/**
 * Service Fusion names that do not match a Loop display name on their own.
 * The value is the Loop profile name to use instead.
 */
export const SF_TECH_ALIASES: Readonly<Record<string, string>> = {
  "Kameron K.": "Kameron Kuhn",
  "Collin Qualkenbush": "Collin",
};

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
  aliases: Readonly<Record<string, string>> = SF_TECH_ALIASES,
): { matched: MatchedTech[]; unmatched: UnmatchedTech[] } {
  const aliasByName = new Map<string, string>();
  for (const [sfName, loopName] of Object.entries(aliases)) {
    const key = normalizePersonName(sfName);
    const target = loopName.trim();
    if (key && target) aliasByName.set(key, target);
  }
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
    const aliasTarget = aliasByName.get(key);
    const aliasMatches = aliasTarget ? byName.get(normalizePersonName(aliasTarget)) ?? [] : [];
    const directMatches = byName.get(key) ?? [];
    const aliased = aliasMatches.length === 1;
    const found = aliased ? aliasMatches : aliasMatches.length > 1 ? aliasMatches : directMatches;
    if (found.length === 1) {
      if (seenUsers.has(found[0].id)) continue;
      seenUsers.add(found[0].id);
      matched.push({
        sfId: tech.sfId,
        userId: found[0].id,
        fullName: found[0].fullName,
        sfName: display,
        aliased,
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
