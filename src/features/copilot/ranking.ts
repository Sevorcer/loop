import type { CopilotIntent, CopilotResolvedContext, SearchRecord } from "./types";

function normalize(text: string) {
  return text.toLowerCase();
}

const TITLE_EXACT_MATCH_SCORE = 24;
const TITLE_PREFIX_MATCH_SCORE = 16;
const TITLE_PARTIAL_MATCH_SCORE = 10;
const TOKEN_EXACT_MATCH_SCORE = 16;
const TOKEN_COVERAGE_MULTIPLIER = 2;

const JOB_IN_PROGRESS_BOOST = 12;
const JOB_SCHEDULED_BOOST = 10;
const JOB_ON_HOLD_BOOST = 4;
const INSTALLED_SYSTEM_ACTIVE_BOOST = 8;
const ACTIVE_ENTITY_BOOST = 5;
const RECENT_ACTIVITY_WEEK_BOOST = 8;
const RECENT_ACTIVITY_MONTH_BOOST = 5;
const RECENT_ACTIVITY_QUARTER_BOOST = 3;

function parseTimestamp(value: string | undefined) {
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
    score += TITLE_EXACT_MATCH_SCORE;
  } else if (normalizedTitle.startsWith(trimmedQuery)) {
    score += TITLE_PREFIX_MATCH_SCORE;
  } else if (normalizedTitle.includes(trimmedQuery)) {
    score += TITLE_PARTIAL_MATCH_SCORE;
  }

  const normalizedTokens = record.tokens.map((token) => normalize(token));
  if (normalizedTokens.includes(trimmedQuery)) {
    score += TOKEN_EXACT_MATCH_SCORE;
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

  return score + coverage * TOKEN_COVERAGE_MULTIPLIER;
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
    if (status === "in progress") score += JOB_IN_PROGRESS_BOOST;
    else if (status === "scheduled") score += JOB_SCHEDULED_BOOST;
    else if (status === "on hold") score += JOB_ON_HOLD_BOOST;
  }

  if (record.domain === "installed_systems" && status === "active") {
    score += INSTALLED_SYSTEM_ACTIVE_BOOST;
  }

  if ((record.domain === "customers" || record.domain === "properties") && status === "active") {
    score += ACTIVE_ENTITY_BOOST;
  }

  const timestamp = parseTimestamp(record.metadata?.timestamp);
  if (timestamp) {
    const ageInDays = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays <= 7) score += RECENT_ACTIVITY_WEEK_BOOST;
    else if (ageInDays <= 30) score += RECENT_ACTIVITY_MONTH_BOOST;
    else if (ageInDays <= 90) score += RECENT_ACTIVITY_QUARTER_BOOST;
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
