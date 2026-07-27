/**
 * Shared validation constants for knowledge item API routes.
 */

export const VALID_KNOWLEDGE_TYPES = new Set<string>([
  "sop",
  "installation_guide",
  "service_bulletin",
  "troubleshooting",
  "safety_procedure",
  "best_practice",
  "policy",
  "training",
  "faq",
]);

export const VALID_KNOWLEDGE_STATUSES = new Set<string>([
  "draft",
  "reviewed",
  "published",
  "improved",
  "archived",
]);
