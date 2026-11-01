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
 * Phones hide the corner buttons. Search and feedback move into the
 * slide-out menu instead.
 *
 * The cutoff is Tailwind's `md` breakpoint (768px). That matches the width
 * the shell already treats as a phone when a sticky action bar would sit
 * under the buttons (`max-width: 767px` in globals.css). Tablet and desktop
 * keep the buttons, including on the job forms that hide them by route.
 *
 * The slide-out menu itself stays available up to `lg` (1024px), which
 * includes tablets. The menu entries are phone-only so a tablet does not
 * show them next to the corner buttons. The desktop sidebar never receives
 * the entries.
 */
export const CORNER_ACTIONS_VISIBILITY_CLASS = "hidden md:flex";
export const PHONE_NAV_ACTIONS_VISIBILITY_CLASS = "md:hidden";
