import type { CopilotIntent, CopilotResolvedContext, SearchRecord } from "./types";

function normalize(text: string) {
  return text.toLowerCase();
}

function scoreByTokens(query: string, record: SearchRecord): number {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return 0;
  }

  const queryTokens = trimmedQuery.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const token of queryTokens) {
    for (const field of record.tokens) {
      const normalizedField = normalize(field);
      if (normalizedField === token) {
        score += 6;
      } else if (normalizedField.startsWith(token)) {
        score += 4;
      } else if (normalizedField.includes(token)) {
        score += 2;
      }
    }
  }

  return score;
}

function scoreByIntent(intent: CopilotIntent, record: SearchRecord): number {
  if (intent === "navigation" && record.kind === "navigation") {
    return 12;
  }

  if (intent === "manual_lookup" && record.kind === "manual") {
    return 12;
  }

  if (intent === "photo_lookup" && record.kind === "photo") {
    return 12;
  }

  if (intent === "search" && record.kind === "entity") {
    return 2;
  }

  return 0;
}

function scoreByContext(context: CopilotResolvedContext, record: SearchRecord): number {
  let score = 0;

  if (context.projectId && context.projectId === record.contextRefs?.projectId) {
    score += 8;
  }

  if (context.propertyId && context.propertyId === record.contextRefs?.propertyId) {
    score += 8;
  }

  if (context.jobId && context.jobId === record.contextRefs?.jobId) {
    score += 8;
  }

  if (
    context.installedSystemId &&
    context.installedSystemId === record.contextRefs?.installedSystemId
  ) {
    score += 8;
  }

  if (context.customerId && context.customerId === record.contextRefs?.customerId) {
    score += 8;
  }

  return score;
}

export function scoreRecord(
  query: string,
  intent: CopilotIntent,
  context: CopilotResolvedContext,
  record: SearchRecord
): number {
  const tokenScore = scoreByTokens(query, record);
  const intentScore = scoreByIntent(intent, record);
  const contextScore = scoreByContext(context, record);

  return tokenScore + intentScore + contextScore;
}
