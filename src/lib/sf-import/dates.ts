/**
 * The later of two calendar days (YYYY-MM-DD).
 * A missing side does not erase the date that is present.
 * Equal days stay as they are. Used when an import updates a customer so
 * last activity never moves backwards.
 */
export function laterCalendarDate(
  loopDate: string | null | undefined,
  sfDate: string | null | undefined,
): string | null {
  const loop = normalize(loopDate);
  const sf = normalize(sfDate);
  if (!loop) return sf;
  if (!sf) return loop;
  return loop > sf ? loop : sf;
}

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? null;
}
