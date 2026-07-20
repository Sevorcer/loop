import type { CopilotIntent } from "./types";

const NAVIGATION_VERBS = ["go to", "open", "navigate", "take me", "jump to"];
const MANUAL_TERMS = ["manual", "submittal", "document", "docs", "pdf", "spec"];
const PHOTO_TERMS = ["photo", "photos", "image", "images", "picture", "site photo"];
const CONVERSATION_PREFIXES = ["how", "why", "what", "who", "when", "where", "explain"];

export function parseCopilotIntent(query: string): CopilotIntent {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return "search";
  }

  if (PHOTO_TERMS.some((term) => normalized.includes(term))) {
    return "photo_lookup";
  }

  if (MANUAL_TERMS.some((term) => normalized.includes(term))) {
    return "manual_lookup";
  }

  if (NAVIGATION_VERBS.some((term) => normalized.includes(term))) {
    return "navigation";
  }

  if (
    normalized.endsWith("?") ||
    CONVERSATION_PREFIXES.some((prefix) => normalized.startsWith(`${prefix} `))
  ) {
    return "conversation";
  }

  return "search";
}
