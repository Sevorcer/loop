/**
 * Where a manual opens (pure).
 *
 * A manual with a stored copy opens from LOOP itself (same-origin PDF stream);
 * Google Drive is only the fallback while no copy has been stored.
 */

import { ROUTE_BUILDERS } from "@/lib/routes";

import type { DriveManualFile } from "../types/manuals";

export interface ManualLink {
  href: string;
  /** True when the link leaves LOOP (Drive fallback). Drives the external-link icon. */
  external: boolean;
}

export function manualLink(
  manual: Pick<DriveManualFile, "id" | "webViewLink" | "hasLocalFile">,
): ManualLink | null {
  if (manual.hasLocalFile) return { href: ROUTE_BUILDERS.MANUAL_FILE(manual.id), external: false };
  if (manual.webViewLink) return { href: manual.webViewLink, external: true };
  return null;
}
