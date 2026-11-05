/**
 * Who may do what with Drive manuals (#33 / #32). Mirrors the RLS in
 * 20261121100000_drive_manual_index.sql and 20261121300000_installed_system_manuals.sql.
 */

export const MANUAL_MANAGER_ROLES = ["owner", "manager", "dispatch", "office"] as const;
export const MANUAL_READER_ROLES = ["owner", "manager", "dispatch", "office", "sales", "tech"] as const;

export function canManageManuals(role: string | null | undefined): boolean {
  return !!role && (MANUAL_MANAGER_ROLES as readonly string[]).includes(role);
}

export function canReadManuals(role: string | null | undefined): boolean {
  return !!role && (MANUAL_READER_ROLES as readonly string[]).includes(role);
}
