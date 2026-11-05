/**
 * Checklist item permissions (field feedback R1, 2026-11-05).
 *
 * Replaces standing rule B3 (anyone can ADD; only office+ can REMOVE).
 * New rule: install-level users (techs) can edit AND delete checklist items
 * in addition to adding them. Portal / customer accounts stay off the list.
 */
const CHECKLIST_ADD_ROLES = new Set([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
]);

/**
 * Who may REMOVE a checklist item: office and above, plus techs (R1).
 * Dispatch and sales still cannot delete.
 */
const CHECKLIST_REMOVE_ROLES = new Set(["owner", "manager", "office", "tech"]);

/** Roles that may check an item off or rename it: office roles plus techs. */
const CHECKLIST_CHECK_ROLES = new Set([
  "owner",
  "manager",
  "office",
  "dispatch",
  "tech",
]);

/** Anyone in the org may add a checklist item. */
export function canAddJobChecklistItem(role: string | null | undefined): boolean {
  return CHECKLIST_ADD_ROLES.has(role ?? "");
}

/** Office and above, plus techs, may remove a checklist item (R1). */
export function canRemoveJobChecklistItem(role: string | null | undefined): boolean {
  return CHECKLIST_REMOVE_ROLES.has(role ?? "");
}

/** A technician (and the office) may check a task off or rename it. */
export function canCheckJobTask(role: string | null | undefined): boolean {
  return CHECKLIST_CHECK_ROLES.has(role ?? "");
}

/** Alias for rename/edit — same roles as check-off (R1). */
export function canEditJobChecklistItem(role: string | null | undefined): boolean {
  return canCheckJobTask(role);
}
