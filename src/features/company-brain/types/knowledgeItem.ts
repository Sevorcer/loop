// ============================================================
// Company Brain — Type System
// Sprint 20
//
// Company Brain is the operational owner of organizational knowledge.
// It captures what the company learns and makes that knowledge
// reusable across all operational domains.
//
// Core question: "What does the company already know that should
// help us right now?"
//
// Domain model:
//   KnowledgeItem → KnowledgeRelationship → KnowledgeUsage
//
// KnowledgeItem is the aggregate root. All Company Brain objects
// reference it rather than becoming independent sources of truth.
//
// Company Brain references (but does not own):
//   Equipment, Installed Systems, Inventory, Jobs,
//   Manufacturers, Customers, Properties
// ============================================================

// ------------------------------------------------------------------
// Knowledge Type
// Structured categories that help organize retrieval and expectation
// without requiring knowledge to live in folders.
// ------------------------------------------------------------------

export type KnowledgeType =
  | "sop"
  | "installation_guide"
  | "service_bulletin"
  | "troubleshooting"
  | "safety_procedure"
  | "best_practice"
  | "policy"
  | "training"
  | "faq";

// ------------------------------------------------------------------
// Knowledge Lifecycle
// Knowledge should evolve over time as the company continues to learn.
// Knowledge does not become static forever.
// ------------------------------------------------------------------

export type KnowledgeStatus =
  /** Knowledge is being created — not yet ready for operational use */
  | "draft"
  /** Knowledge has been checked for accuracy or usefulness */
  | "reviewed"
  /** Knowledge is ready for operational use */
  | "published"
  /** Knowledge has been updated based on new learning */
  | "improved"
  /** Knowledge is retained but no longer active for current operations */
  | "archived";

// ------------------------------------------------------------------
// Related Domains
// The operational domains that Company Brain references.
// Company Brain does NOT own these domains — it references them.
// ------------------------------------------------------------------

export type KnowledgeRelatedDomain =
  | "equipment"
  | "installed_systems"
  | "inventory"
  | "jobs"
  | "manufacturers"
  | "customers"
  | "properties"
  | "procedures"
  | "dispatch";

// ------------------------------------------------------------------
// Knowledge Item — Aggregate Root
// The canonical unit of organizational knowledge.
//
// All other Company Brain objects (KnowledgeRelationship,
// KnowledgeUsage) reference the KnowledgeItem rather than
// becoming separate sources of truth.
// ------------------------------------------------------------------

export interface KnowledgeItem {
  id: string;
  title: string;

  /** A short one-to-two sentence description of what this knowledge covers */
  summary: string;

  /** Full knowledge content — what the company has learned */
  body: string;

  /** Structured type — helps organize retrieval without requiring folders */
  knowledgeType: KnowledgeType;

  /** Lifecycle state — knowledge evolves as the company learns */
  status: KnowledgeStatus;

  /** Monotonically increasing version number */
  version: number;

  /** Searchable tags — operational context (equipment models, job types, etc.) */
  tags: string[];

  /** The person or role responsible for this knowledge item */
  owner: string;

  /** Which operational domains this knowledge applies to */
  relatedDomains: KnowledgeRelatedDomain[];

  /** ISO timestamp when this item was first created */
  createdAt: string;

  /** ISO timestamp of the most recent change */
  updatedAt: string;
}

// ------------------------------------------------------------------
// Knowledge Relationship
// Connects knowledge to operational truth in other domains.
//
// Company Brain references the operational domains — it does not
// replicate their data. The relatedEntityId is a foreign reference.
// ------------------------------------------------------------------

export type KnowledgeRelationshipType =
  | "references"
  | "required_for"
  | "recommended_for"
  | "supersedes";

export interface KnowledgeRelationship {
  id: string;
  /** References the aggregate root */
  knowledgeItemId: string;
  relatedDomain: KnowledgeRelatedDomain;
  /** Foreign ID of the entity in its own domain */
  relatedEntityId: string;
  /** Human-readable label — avoids requiring a join just for display */
  relatedEntityLabel: string;
  relationshipType: KnowledgeRelationshipType;
  notes?: string;
}

// ------------------------------------------------------------------
// Knowledge Usage
// Tracks whether knowledge is actually helping operations.
//
// This is not primarily for vanity analytics — it exists to
// understand whether knowledge is being used and improved.
// ------------------------------------------------------------------

export type KnowledgeUsageEvent =
  | "viewed"
  | "referenced"
  | "linked"
  | "updated";

export interface KnowledgeUsage {
  id: string;
  /** References the aggregate root */
  knowledgeItemId: string;
  event: KnowledgeUsageEvent;
  /** Operational context where this knowledge was accessed */
  context?: string;
  /** ISO timestamp */
  timestamp: string;
}

// ------------------------------------------------------------------
// Knowledge Search Query
// Knowledge retrieval is contextual — users ask operational questions,
// not document titles.
// ------------------------------------------------------------------

export interface KnowledgeSearchQuery {
  /** Free-text search against title, summary, body, and tags */
  text?: string;
  /** Filter to specific knowledge types */
  types?: KnowledgeType[];
  /** Filter to specific lifecycle states */
  statuses?: KnowledgeStatus[];
  /** Filter to items related to a specific domain */
  relatedDomain?: KnowledgeRelatedDomain;
  /** Filter to items tagged with this value */
  tag?: string;
}

// ------------------------------------------------------------------
// Knowledge Snapshot — assembled result passed to CompanyBrainScreen
// ------------------------------------------------------------------

export interface KnowledgeSnapshot {
  items: KnowledgeItem[];
  relationships: KnowledgeRelationship[];
  usage: KnowledgeUsage[];
  metrics: {
    totalItems: number;
    published: number;
    draft: number;
    reviewed: number;
    improved: number;
    archived: number;
  };
}
