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

/**
 * Field feedback 2026-11-05 (item 6): phones must show the same Copilot and
 * feedback corner buttons as desktop. The stack stays visible at every
 * breakpoint; job create/edit still hide it via hidesFloatingActions.
 *
 * Phone slide-out menu still carries Ask Copilot + Send feedback as a
 * backup (and as the only entry on job forms). Those menu rows stay
 * phone-only so tablets/desktops that already see the corner buttons do
 * not also see duplicates in the drawer. The desktop sidebar never
 * receives the entries.
 *
 * Sticky mobile action bars lift the stack via globals.css
 * (body[data-mobile-action-bar="1"]).
 */
export const CORNER_ACTIONS_VISIBILITY_CLASS = "flex";
export const PHONE_NAV_ACTIONS_VISIBILITY_CLASS = "md:hidden";
