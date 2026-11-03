/**
 * Everyone on the internal team may ADD a checklist item (B3). Portal /
 * customer accounts are external and stay off the list entirely.
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
 * Only office and above may REMOVE a checklist item (B3): office, manager,
 * owner — not dispatch, not tech. Keeps the crew from deleting work off the
 * list while still letting anyone add to it.
 */
const CHECKLIST_REMOVE_ROLES = new Set(["owner", "manager", "office"]);

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

/** Office and above may remove a checklist item. */
export function canRemoveJobChecklistItem(role: string | null | undefined): boolean {
  return CHECKLIST_REMOVE_ROLES.has(role ?? "");
}

/** A technician (and the office) may check a task off or rename it. */
export function canCheckJobTask(role: string | null | undefined): boolean {
  return CHECKLIST_CHECK_ROLES.has(role ?? "");
}
