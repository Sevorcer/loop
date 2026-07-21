/**
 * Admin RBAC policy module — Sprint 29.
 *
 * Defines the authorization contract for the Admin area of LOOP.
 * Admin roles are separate from the operational AppRole set and map to
 * the entity ownership matrix in planning/sprint-29-admin-crud.yml.
 *
 * Principles:
 *   - Deny by default: any role/entity/action combination not explicitly
 *     permitted returns false.
 *   - Server is the source of truth: API routes must call assertAdminPermission
 *     or hasAdminPermission before executing mutations.
 *   - UI mirrors policy via canAdminCreate / canAdminEdit / canAdminDelete
 *     helpers (hide/disable forbidden actions). These are NOT security gates.
 *
 * Entity ownership matrix (canonical — see sprint-29-admin-crud.yml):
 *   Organization: create/edit/delete → platform_admin only
 *   Customer:     create/edit        → platform_admin, ops_admin, ops_editor
 *                 delete             → platform_admin, ops_admin
 *   Property:     create/edit        → platform_admin, ops_admin, ops_editor
 *                 delete             → platform_admin, ops_admin
 *   Job:          create/edit        → platform_admin, ops_admin, ops_editor
 *                 delete             → platform_admin only
 *
 * All admin roles may view (select) every entity.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four recognized admin roles, ordered from most to least privileged. */
export type AdminRole =
  | "platform_admin"
  | "ops_admin"
  | "ops_editor"
  | "ops_viewer";

/** Entities managed through the Admin area. */
export type AdminEntity = "organization" | "customer" | "property" | "job";

/** Mutation and read actions available on admin entities. */
export type AdminAction = "create" | "edit" | "delete" | "view";

// ---------------------------------------------------------------------------
// Policy matrix
//
// Structure: ADMIN_POLICY[entity][action] = ReadonlySet<AdminRole>
//
// Any role NOT in the set is denied. "view" is granted to all admin roles
// uniformly rather than being listed per-entity to avoid drift.
// ---------------------------------------------------------------------------

type AdminRoleSet = ReadonlySet<AdminRole>;
type EntityPolicy = Readonly<Record<AdminAction, AdminRoleSet>>;

const ALL_ADMIN_ROLES: AdminRoleSet = new Set<AdminRole>([
  "platform_admin",
  "ops_admin",
  "ops_editor",
  "ops_viewer",
]);

const ADMIN_POLICY: Readonly<Record<AdminEntity, EntityPolicy>> = {
  organization: {
    view: ALL_ADMIN_ROLES,
    create: new Set<AdminRole>(["platform_admin"]),
    edit: new Set<AdminRole>(["platform_admin"]),
    delete: new Set<AdminRole>(["platform_admin"]),
  },
  customer: {
    view: ALL_ADMIN_ROLES,
    create: new Set<AdminRole>(["platform_admin", "ops_admin", "ops_editor"]),
    edit: new Set<AdminRole>(["platform_admin", "ops_admin", "ops_editor"]),
    delete: new Set<AdminRole>(["platform_admin", "ops_admin"]),
  },
  property: {
    view: ALL_ADMIN_ROLES,
    create: new Set<AdminRole>(["platform_admin", "ops_admin", "ops_editor"]),
    edit: new Set<AdminRole>(["platform_admin", "ops_admin", "ops_editor"]),
    delete: new Set<AdminRole>(["platform_admin", "ops_admin"]),
  },
  job: {
    view: ALL_ADMIN_ROLES,
    create: new Set<AdminRole>(["platform_admin", "ops_admin", "ops_editor"]),
    edit: new Set<AdminRole>(["platform_admin", "ops_admin", "ops_editor"]),
    delete: new Set<AdminRole>(["platform_admin"]),
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_ADMIN_ROLES: ReadonlySet<string> = new Set<AdminRole>([
  "platform_admin",
  "ops_admin",
  "ops_editor",
  "ops_viewer",
]);

/**
 * Returns true when the given string is a recognized AdminRole.
 * Useful for parsing role values from headers or JWT claims.
 */
export function isAdminRole(value: string): value is AdminRole {
  return VALID_ADMIN_ROLES.has(value);
}

// ---------------------------------------------------------------------------
// Core policy check (pure function — testable without side effects)
// ---------------------------------------------------------------------------

/**
 * Returns true when `role` is permitted to perform `action` on `entity`.
 *
 * Deny by default: returns false for any unrecognized role value, even
 * if `AdminRole` typing is satisfied at compile time.
 *
 * @param role   — The requesting user's admin role.
 * @param entity — The entity being acted upon.
 * @param action — The action being attempted.
 */
export function hasAdminPermission(
  role: AdminRole,
  entity: AdminEntity,
  action: AdminAction
): boolean {
  return ADMIN_POLICY[entity][action].has(role);
}

/**
 * Throws an `AdminAuthorizationError` when the role is not permitted.
 * Use at server-side API boundaries as the authorization gate.
 *
 * @throws {AdminAuthorizationError}
 */
export function assertAdminPermission(
  role: AdminRole,
  entity: AdminEntity,
  action: AdminAction
): void {
  if (!hasAdminPermission(role, entity, action)) {
    throw new AdminAuthorizationError(role, entity, action);
  }
}

// ---------------------------------------------------------------------------
// UI helpers (for hide/disable behavior — NOT security enforcement)
// ---------------------------------------------------------------------------

/**
 * UI helper: returns true when the role can create records of the given entity.
 * Components should hide or disable the create action when this returns false.
 */
export function canAdminCreate(role: AdminRole, entity: AdminEntity): boolean {
  return hasAdminPermission(role, entity, "create");
}

/**
 * UI helper: returns true when the role can edit records of the given entity.
 * Components should hide or disable edit controls when this returns false.
 */
export function canAdminEdit(role: AdminRole, entity: AdminEntity): boolean {
  return hasAdminPermission(role, entity, "edit");
}

/**
 * UI helper: returns true when the role can delete records of the given entity.
 * Components should hide or disable delete controls when this returns false.
 */
export function canAdminDelete(role: AdminRole, entity: AdminEntity): boolean {
  return hasAdminPermission(role, entity, "delete");
}

/**
 * Returns all roles that are permitted to perform `action` on `entity`.
 * Useful for documentation, tests, and policy audit tooling.
 */
export function allowedAdminRolesFor(
  entity: AdminEntity,
  action: AdminAction
): AdminRole[] {
  return Array.from(ADMIN_POLICY[entity][action]);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AdminAuthorizationError extends Error {
  readonly role: AdminRole;
  readonly entity: AdminEntity;
  readonly action: AdminAction;

  constructor(role: AdminRole, entity: AdminEntity, action: AdminAction) {
    super(
      `Admin authorization denied: role '${role}' cannot perform '${action}' on '${entity}'`
    );
    this.name = "AdminAuthorizationError";
    this.role = role;
    this.entity = entity;
    this.action = action;
  }
}
