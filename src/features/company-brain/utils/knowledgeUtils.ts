// ============================================================
// Company Brain — Derivation Utils
// Sprint 20
//
// All snapshot views are derived from core domain objects.
// No component computes search results or lifecycle state
// independently of these utilities.
// ============================================================

import type {
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeSearchQuery,
  KnowledgeSnapshot,
  KnowledgeStatus,
  KnowledgeType,
  KnowledgeUsage,
} from "../types/knowledgeItem";

// ------------------------------------------------------------------
// Knowledge Type Labels
// Human-readable display names for each structured knowledge type.
// ------------------------------------------------------------------

export function getKnowledgeTypeLabel(type: KnowledgeType): string {
  switch (type) {
    case "sop":
      return "SOP";
    case "installation_guide":
      return "Installation Guide";
    case "service_bulletin":
      return "Service Bulletin";
    case "troubleshooting":
      return "Troubleshooting";
    case "safety_procedure":
      return "Safety Procedure";
    case "best_practice":
      return "Best Practice";
    case "policy":
      return "Policy";
    case "training":
      return "Training";
    case "faq":
      return "FAQ";
  }
}

// ------------------------------------------------------------------
// Knowledge Status Labels
// Human-readable explanation of where knowledge is in its lifecycle.
// ------------------------------------------------------------------

export function getKnowledgeStatusLabel(status: KnowledgeStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "reviewed":
      return "Reviewed";
    case "published":
      return "Published";
    case "improved":
      return "Improved";
    case "archived":
      return "Archived";
  }
}

// ------------------------------------------------------------------
// Search
// Company Brain answers operational questions, not folder paths.
// Search is retrieval, not navigation.
// ------------------------------------------------------------------

/**
 * Filter knowledge items using an operational search query.
 *
 * Free-text search checks title, summary, body, and tags.
 * All filters are additive — items must match ALL provided criteria.
 */
export function searchKnowledgeItems(
  items: KnowledgeItem[],
  query: KnowledgeSearchQuery
): KnowledgeItem[] {
  let results = items;

  if (query.text && query.text.trim().length > 0) {
    const term = query.text.toLowerCase().trim();
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.summary.toLowerCase().includes(term) ||
        item.body.toLowerCase().includes(term) ||
        item.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  }

  if (query.types && query.types.length > 0) {
    results = results.filter((item) =>
      query.types!.includes(item.knowledgeType)
    );
  }

  if (query.statuses && query.statuses.length > 0) {
    results = results.filter((item) =>
      query.statuses!.includes(item.status)
    );
  }

  if (query.relatedDomain) {
    results = results.filter((item) =>
      item.relatedDomains.includes(query.relatedDomain!)
    );
  }

  if (query.tag) {
    const tagTerm = query.tag.toLowerCase();
    results = results.filter((item) =>
      item.tags.some((t) => t.toLowerCase().includes(tagTerm))
    );
  }

  return results;
}

// ------------------------------------------------------------------
// Relationship helpers
// ------------------------------------------------------------------

export function getRelationshipsForItem(
  relationships: KnowledgeRelationship[],
  knowledgeItemId: string
): KnowledgeRelationship[] {
  return relationships.filter((r) => r.knowledgeItemId === knowledgeItemId);
}

// ------------------------------------------------------------------
// Usage helpers
// ------------------------------------------------------------------

export function getUsageForItem(
  usage: KnowledgeUsage[],
  knowledgeItemId: string
): KnowledgeUsage[] {
  return usage.filter((u) => u.knowledgeItemId === knowledgeItemId);
}

export function getRecentUsage(
  usage: KnowledgeUsage[],
  limitDays = 7
): KnowledgeUsage[] {
  const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;
  return usage
    .filter((u) => new Date(u.timestamp).getTime() > cutoff)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

export function getKnowledgeUsageEventLabel(event: KnowledgeUsage["event"]): string {
  switch (event) {
    case "viewed":
      return "Viewed";
    case "referenced":
      return "Referenced";
    case "linked":
      return "Linked";
    case "updated":
      return "Updated";
  }
}

// ------------------------------------------------------------------
// Contextual surfacing
// Returns the most relevant knowledge items for an operational domain.
// This is how Company Brain surfaces knowledge where it is needed —
// without the user having to navigate to it.
// ------------------------------------------------------------------

export function getItemsForDomain(
  items: KnowledgeItem[],
  domain: KnowledgeItem["relatedDomains"][number]
): KnowledgeItem[] {
  return items.filter(
    (item) =>
      item.relatedDomains.includes(domain) && item.status !== "archived"
  );
}

// ------------------------------------------------------------------
// Snapshot Assembly
// Assembles all domain data into a single view object.
// ------------------------------------------------------------------

export function assembleKnowledgeSnapshot(
  items: KnowledgeItem[],
  relationships: KnowledgeRelationship[],
  usage: KnowledgeUsage[]
): KnowledgeSnapshot {
  const metrics = {
    totalItems: items.length,
    published: items.filter((i) => i.status === "published").length,
    draft: items.filter((i) => i.status === "draft").length,
    reviewed: items.filter((i) => i.status === "reviewed").length,
    improved: items.filter((i) => i.status === "improved").length,
    archived: items.filter((i) => i.status === "archived").length,
  };

  return { items, relationships, usage, metrics };
}

// ------------------------------------------------------------------
// Format helpers
// ------------------------------------------------------------------

export function formatKnowledgeDate(isoTimestamp: string): string {
  if (!isoTimestamp) return "";
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDate(isoTimestamp: string): string {
  if (!isoTimestamp) return "";
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
