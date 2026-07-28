import type { CopilotIntent, CopilotResolvedContext, SearchRecord } from "./types";

function normalize(text: string) {
  return text.toLowerCase();
}

function parseDateValue(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function scoreByExactAndPrefix(query: string, record: SearchRecord): number {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return 0;
  }

  let score = 0;
  const normalizedTitle = normalize(record.title);

  if (normalizedTitle === trimmedQuery) {
    score += 24;
  } else if (normalizedTitle.startsWith(trimmedQuery)) {
    score += 16;
  } else if (normalizedTitle.includes(trimmedQuery)) {
    score += 10;
  }

  const normalizedTokens = record.tokens.map((token) => normalize(token));
  if (normalizedTokens.includes(trimmedQuery)) {
    score += 16;
  }

  return score;
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

  const coverage = queryTokens.filter((token) =>
    record.tokens.some((field) => normalize(field).includes(token)),
  ).length;

  return score + coverage * 2;
}

function scoreByIntent(intent: CopilotIntent, record: SearchRecord): number {
  if (intent === "navigation" && record.recordType === "navigation") {
    return 12;
  }

  if (intent === "manual_lookup" && record.recordType === "manual") {
    return 12;
  }

  if (intent === "photo_lookup" && record.recordType === "photo") {
    return 12;
  }

  if (intent === "search" && record.recordType === "entity") {
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

function scoreByOperationalSignals(record: SearchRecord): number {
  let score = 0;
  const status = record.metadata?.status?.toLowerCase();

  if (record.domain === "jobs") {
    if (status === "in progress") score += 12;
    else if (status === "scheduled") score += 10;
    else if (status === "on hold") score += 4;
  }

  if (record.domain === "installed_systems" && status === "active") {
    score += 8;
  }

  if ((record.domain === "customers" || record.domain === "properties") && status === "active") {
    score += 5;
  }

  const timestamp = parseDateValue(record.metadata?.timestamp);
  if (timestamp) {
    const ageInDays = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays <= 7) score += 8;
    else if (ageInDays <= 30) score += 5;
    else if (ageInDays <= 90) score += 3;
  }

  return score;
}

export function scoreRecord(
  query: string,
  intent: CopilotIntent,
  context: CopilotResolvedContext,
  record: SearchRecord
): number {
  const exactPrefixScore = scoreByExactAndPrefix(query, record);
  const tokenScore = scoreByTokens(query, record);
  const intentScore = scoreByIntent(intent, record);
  const contextScore = scoreByContext(context, record);
  const operationalScore = scoreByOperationalSignals(record);

  return exactPrefixScore + tokenScore + intentScore + contextScore + operationalScore;
}
