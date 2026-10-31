/** Office staff who may add or remove checklist items. Dispatch counts as office. */
const CHECKLIST_OFFICE_ROLES = new Set(["owner", "manager", "office", "dispatch"]);

export function canManageJobChecklist(role: string | null | undefined): boolean {
  return CHECKLIST_OFFICE_ROLES.has(role ?? "");
}

/** A technician may check off a task. Adding or deleting one stays with the office. */
export function canCheckJobTask(role: string | null | undefined): boolean {
  return canManageJobChecklist(role) || role === "tech";
}
