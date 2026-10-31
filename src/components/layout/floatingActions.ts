import { ROUTES } from "@/lib/routes";

/**
 * Job create and edit are long forms. The shell's fixed corner buttons
 * sit on top of fields and the save button while the page scrolls, so
 * those routes hide the stack. Every other route keeps it.
 */
const JOB_EDIT_PATH = new RegExp(`^${ROUTES.JOBS}/[^/]+/edit$`);

export function hidesFloatingActions(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/";
  return path === `${ROUTES.JOBS}/new` || JOB_EDIT_PATH.test(path);
}
