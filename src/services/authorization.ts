/**
 * Authorization contract — internal operations roles.
 *
 * This module is the TypeScript mirror of the permission matrix documented in
 * docs/architecture/security/rls-role-matrix.md and enforced in SQL via
 * database/policies/002_role_policies.sql.
 *
 * It provides:
 *   - `AppRole`      — the canonical union of internal operation roles
 *   - `CoreTable`    — the canonical set of core operational tables
 *   - `TableAction`  — the four SQL DML operations
 *   - `hasPermission(role, table, action)` — pure policy check
 *   - `assertPermission(role, table, action)` — throws on denial (server guards)
 *
 * Keep this file in sync with the matrix doc and SQL policies.
 * When adding a new table or role, update all three in the same commit.
 *
 * Sprint 27: Added sprint-27 platform service tables —
 *   storage_objects, gc_issue_requests, installed_systems,
 *   knowledge_items, portal_projects, performance_models
 *
 * Sprint 28: Added db_health_check_runs for the DB health dashboard.
 *   Read-only for owner/manager roles; CI writes via service_role (bypasses RLS).
 *
 * Sprint 7 Mini-Epic: Added feedback_reports for in-app feedback capture.
 *   Insert: all operational staff. Select: owner/manager (+ techs for own
 *   submissions). Update: owner/manager. Delete: owner.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppRole =
  | "owner"
  | "manager"
  | "dispatch"
  | "tech"
  | "office"
  | "sales"
  | "portal";

export type CoreTable =
  | "customers"
  | "properties"
  | "property_documents"
  | "property_photos"
  | "contractors"
  | "jobs"
  | "job_activity"
  | "portal_users"
  | "portal_memberships"
  // Sprint 27 — platform service tables
  | "storage_objects"
  | "gc_issue_requests"
  | "installed_systems"
  | "knowledge_items"
  | "portal_projects"
  | "performance_models"
  // Sprint 29 — admin CRUD tables
  // Organizations are platform-level; mutations restricted to `owner` until
  // the S29-002 `platform_admin` role is introduced.
  | "organizations"
  // Sprint 28 — DB health check tables
  // Read-only in the app layer; CI writes via service_role (bypasses RLS).
  | "db_health_check_runs"
  // Sprint 7 Mini-Epic — In-app feedback capture
  | "feedback_reports"
  // Sprint 7 Settings Enhancements — user management
  // owner/manager may manage org users; owner alone may delete.
  | "user_profiles";

export type TableAction = "select" | "insert" | "update" | "delete";

// ---------------------------------------------------------------------------
// Permission matrix
//
// Structure: PERMISSIONS[table][action] = Set<AppRole>
//
// "own" semantics (tech on jobs, tech on job_activity, portal on portal_users)
// are noted in comments. Row-scope restrictions are enforced at the database
// layer via RLS; this contract captures whether any access is granted at all.
// ---------------------------------------------------------------------------

type RoleSet = ReadonlySet<AppRole>;

type TablePermissions = Readonly<Record<TableAction, RoleSet>>;

const PERMISSIONS: Readonly<Record<CoreTable, TablePermissions>> = {
  customers: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    update: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    delete: new Set<AppRole>(["owner"]),
  },

  properties: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    update: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    delete: new Set<AppRole>(["owner"]),
  },

  property_documents: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    update: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    delete: new Set<AppRole>(["owner"]),
  },

  property_photos: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    update: new Set<AppRole>(["owner", "manager", "office", "sales"]),
    delete: new Set<AppRole>(["owner"]),
  },

  contractors: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner"]),
  },

  jobs: {
    // tech: own rows only — RLS enforces the row-scope restriction
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "office"]),
    // dispatch/tech: status column only — enforced at application layer
    update: new Set<AppRole>(["owner", "manager", "dispatch", "tech"]),
    delete: new Set<AppRole>(["owner"]),
  },

  job_activity: {
    // tech: own job rows only — RLS enforces the row-scope restriction
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office"]),
    // append-only: tech may insert for own jobs
    insert: new Set<AppRole>(["owner", "manager", "dispatch", "tech"]),
    // no UPDATE or DELETE: log is immutable
    update: new Set<AppRole>([]),
    delete: new Set<AppRole>([]),
  },

  portal_users: {
    // portal: own row only — RLS enforces the row-scope restriction
    select: new Set<AppRole>(["owner", "manager", "portal"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    // portal: own row only
    update: new Set<AppRole>(["owner", "manager", "portal"]),
    delete: new Set<AppRole>(["owner"]),
  },

  portal_memberships: {
    // portal: own row only
    select: new Set<AppRole>(["owner", "manager", "portal"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner"]),
  },

  // ── Sprint 27 tables ─────────────────────────────────────────────────────

  storage_objects: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner", "manager"]),
  },

  gc_issue_requests: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    // only dispatch role and above may triage/update
    update: new Set<AppRole>(["owner", "manager", "dispatch"]),
    delete: new Set<AppRole>(["owner", "manager"]),
  },

  installed_systems: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager", "tech", "office"]),
    update: new Set<AppRole>(["owner", "manager", "tech", "office"]),
    delete: new Set<AppRole>(["owner", "manager"]),
  },

  knowledge_items: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner", "manager"]),
  },

  portal_projects: {
    // portal role can also read (row-level visibility enforced in RLS)
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales", "portal"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner", "manager"]),
  },

  performance_models: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner", "manager"]),
  },

  // ── Sprint 29 — admin CRUD tables ─────────────────────────────────────────
  // Organizations are platform-level records. Until the `platform_admin` role
  // is introduced in S29-002, `owner` stands in as the most privileged role.
  // All other roles may read; only `owner` may mutate.
  organizations: {
    select: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    insert: new Set<AppRole>(["owner"]),
    update: new Set<AppRole>(["owner"]),
    delete: new Set<AppRole>(["owner"]),
  },

  // ── Sprint 28 — DB health check tables ────────────────────────────────────
  // Read-only from the app layer. Only owner/manager may view health data.
  // Inserts come from the CI service-role token (bypasses RLS).
  db_health_check_runs: {
    select: new Set<AppRole>(["owner", "manager"]),
    insert: new Set<AppRole>([]),
    update: new Set<AppRole>([]),
    delete: new Set<AppRole>([]),
  },

  // ── Sprint 7 Mini-Epic — In-app feedback capture ──────────────────────────
  // All operational staff may submit feedback. Only manager/owner may triage;
  // techs may list their own submissions (row-scoped at the API layer).
  feedback_reports: {
    select: new Set<AppRole>(["owner", "manager", "tech"]),
    insert: new Set<AppRole>(["owner", "manager", "dispatch", "tech", "office", "sales"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner"]),
  },
  // ── Sprint 7 Settings Enhancements — user management ─────────────────────
  // owner/manager may view and manage org users.
  // Only `owner` may remove a user profile from the org.
  user_profiles: {
    select: new Set<AppRole>(["owner", "manager"]),
    insert: new Set<AppRole>(["owner", "manager"]),
    update: new Set<AppRole>(["owner", "manager"]),
    delete: new Set<AppRole>(["owner"]),
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when `role` is allowed to perform `action` on `table`.
 *
 * Row-scope restrictions (e.g. tech can only see own assigned jobs) are
 * enforced at the database layer by RLS. This function answers the broader
 * question: "Is this role granted any access at all for this operation?"
 */
export function hasPermission(
  role: AppRole,
  table: CoreTable,
  action: TableAction
): boolean {
  return PERMISSIONS[table][action].has(role);
}

/**
 * Throws an `AuthorizationError` when `role` is not allowed to perform
 * `action` on `table`. Use at server-side call boundaries as a guard rail.
 *
 * Example:
 *   assertPermission(userRole, "jobs", "delete");
 */
export function assertPermission(
  role: AppRole,
  table: CoreTable,
  action: TableAction
): void {
  if (!hasPermission(role, table, action)) {
    throw new AuthorizationError(role, table, action);
  }
}

/**
 * Returns the full set of roles that are allowed to perform `action` on
 * `table`. Useful for generating audit reports and policy documentation.
 */
export function allowedRolesFor(
  table: CoreTable,
  action: TableAction
): AppRole[] {
  return Array.from(PERMISSIONS[table][action]);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AuthorizationError extends Error {
  readonly role: AppRole;
  readonly table: CoreTable;
  readonly action: TableAction;

  constructor(role: AppRole, table: CoreTable, action: TableAction) {
    super(
      `Authorization denied: role '${role}' cannot perform '${action}' on '${table}'`
    );
    this.name = "AuthorizationError";
    this.role = role;
    this.table = table;
    this.action = action;
  }
}
