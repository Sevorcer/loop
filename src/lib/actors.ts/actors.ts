// Actor label helpers.

//
// Timeline and status text must never expose a raw auth-user UUID.
// When an actor id can be resolved to a person's name we show the name;
// when it is an unresolved UUID we show a neutral label instead.

const ACTOR_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMBEDDED_UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function isRawActorId(value: string): boolean {
  return ACTOR_UUID_PATTERN.test(value.trim());
}

export function actorDisplayName(
  actorId: string | null | undefined,
  namesById?: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
): string | null {
  if (!actorId) return null;
  const trimmed = actorId.trim();
  if (!trimmed) return null;
  const mapped =
    namesById instanceof Map ? namesById.get(trimmed) : namesById?.[trimmed];
  if (mapped && mapped.trim()) return mapped.trim();
  if (isRawActorId(trimmed)) return null;
  return trimmed;
}

export function sanitizeActorText(text: string): string {
  return text
    .replace(
      /\s+by\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      " by a team member",
    )
    .replace(EMBEDDED_UUID_PATTERN, "a team member");
}
