// Actor label helpers: timeline/status text must never expose a raw auth-user UUID.
export const ACTOR_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isRawActorId(value: string): boolean { return ACTOR_UUID_PATTERN.test(value.trim()); }
export function actorDisplayName(actorId: string | null | undefined): string | null { if (!actorId) return null; const trimmed = actorId.trim(); if (!trimmed) return null; if (isRawActorId(trimmed)) return null; return trimmed; }
export function sanitizeActorText(text: string): string { return text.replace(/\s+by\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, " by a team member").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "a team member"); }
