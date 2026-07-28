/**
 * permissionsMatrix — utilities for displaying the permission matrix.
 *
 * Extracts data from authorization.ts so that the Roles & Permissions screen
 * can render it without duplicating the matrix definition.
 */

import {
  allowedRolesFor,
  type AppRole,
  type CoreTable,
  type TableAction,
} from "@/services/authorization";

export const ALL_ACTIONS: readonly TableAction[] = ["select", "insert", "update", "delete"];

/** Display labels for table actions */
export const ACTION_LABELS: Record<TableAction, string> = {
  select: "Read",
  insert: "Create",
  update: "Update",
  delete: "Delete",
};

/** Internal operational roles (excludes portal) */
export const OPERATIONAL_ROLES: readonly AppRole[] = [
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
];

/** Display labels for roles */
export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  dispatch: "Dispatch",
  tech: "Technician",
  office: "Office",
  sales: "Sales",
  portal: "Portal",
};

/** Role description strings */
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Full platform access including billing, org settings, and user management.",
  manager: "Manages operations, staff, and workflows across the org.",
  dispatch: "Coordinates job assignments, scheduling, and field communications.",
  tech: "Field technician — can view and update assigned jobs and systems.",
  office: "Office staff — customer management, job creation, and data entry.",
  sales: "Sales team — customer and property visibility, job creation.",
  portal: "External project portal user — limited to portal project access.",
};

/** Core tables exposed in the permission view (operational focus) */
export const DISPLAY_TABLES: readonly CoreTable[] = [
  "customers",
  "properties",
  "jobs",
  "job_activity",
  "contractors",
  "installed_systems",
  "user_profiles",
  "knowledge_items",
  "organizations",
  "feedback_reports",
];

/** Display labels for tables */
export const TABLE_LABELS: Record<CoreTable, string> = {
  customers: "Customers",
  properties: "Properties",
  property_documents: "Property Documents",
  property_photos: "Property Photos",
  contractors: "Contractors",
  jobs: "Jobs",
  job_activity: "Job Activity",
  portal_users: "Portal Users",
  portal_memberships: "Portal Memberships",
  storage_objects: "Storage Objects",
  gc_issue_requests: "GC Issue Requests",
  installed_systems: "Installed Systems",
  knowledge_items: "Knowledge Items",
  portal_projects: "Portal Projects",
  performance_models: "Performance Models",
  organizations: "Organizations",
  db_health_check_runs: "DB Health Checks",
  feedback_reports: "Feedback Reports",
  user_profiles: "User Profiles",
};

export interface RolePermissionRow {
  table: CoreTable;
  tableLabel: string;
  permissions: Record<TableAction, boolean>;
}

/**
 * Returns the permission rows for a given role across all display tables.
 */
export function getPermissionRowsForRole(role: AppRole): RolePermissionRow[] {
  return DISPLAY_TABLES.map((table) => ({
    table,
    tableLabel: TABLE_LABELS[table],
    permissions: {
      select: allowedRolesFor(table, "select").includes(role),
      insert: allowedRolesFor(table, "insert").includes(role),
      update: allowedRolesFor(table, "update").includes(role),
      delete: allowedRolesFor(table, "delete").includes(role),
    },
  }));
}

/**
 * Returns all roles that are granted a specific action on a given table.
 */
export function getRolesForTableAction(
  table: CoreTable,
  action: TableAction
): AppRole[] {
  return allowedRolesFor(table, action);
}
