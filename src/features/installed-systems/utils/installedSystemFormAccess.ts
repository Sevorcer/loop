/**
 * Office-handled warranty fields (Collin, 2026-10-02 / field feedback 2026-11-05).
 * Matches InstalledSystemDetailScreen's canRegisterWarranty set.
 */
const WARRANTY_EDIT_ROLES = new Set(["owner", "manager", "office", "dispatch"]);

export function canEditWarrantyExpiry(role: string | null | undefined): boolean {
  return WARRANTY_EDIT_ROLES.has(role ?? "");
}
