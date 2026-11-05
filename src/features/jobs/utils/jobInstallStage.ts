/**
 * Stage-aware closeout helpers (field feedback 2026-11-05).
 *
 * Full closeout still asks for photos + notes + QA. The installed-system gate
 * and the "startup verification" QA item only apply when the visit actually
 * involves starting up or installing a system. Prep / rough-in / lineset
 * pressure/insulation visits (e.g. JOB-1019 "Lineset/ODU Prep") must be
 * closable without those two.
 *
 * Rule chosen from live titles/summaries on sygdurkefkasgfefvfcs:
 * - Prep when title/summary mentions prep, rough-in, lineset pressure /
 *   insulation work, or the title is primarily a lineset visit.
 * - Override to "involves install/startup" when the text mentions commission,
 *   startup, fire-off, OR clear equipment-install language (hang/install a
 *   unit/system/cassette/heat pump, etc.).
 * - Visit closeout mode already skips every install gate (unchanged).
 */

const STARTUP_OR_COMMISSION =
  /\b(commission(?:ed|ing)?|start[\s-]?up|startup|fire[\s-]?off|fired)\b/;

const EQUIPMENT_INSTALL =
  /\b(?:install(?:ed|ing)?|hang(?:ing)?|set(?:ting)?)\b[\w\s/+-]*\b(?:unit|system|cassette|air\s*handler|heat\s*pump|condenser|furnace|head|odu|idu)\b/;

export function isPrepOrRoughInVisit(
  title: string | null | undefined,
  summary: string | null | undefined = "",
): boolean {
  const titleText = (title ?? "").trim();
  const summaryText = (summary ?? "").trim();
  const text = `${titleText} ${summaryText}`.toLowerCase();
  if (!text.trim()) return false;

  if (STARTUP_OR_COMMISSION.test(text) || EQUIPMENT_INSTALL.test(text)) {
    return false;
  }

  if (/\bprep\b/.test(text)) return true;
  if (/rough[-\s]?in/.test(text)) return true;
  if (
    /\blinesets?\b/.test(text) &&
    /\b(pressur\w*|insulat\w*|rout\w*|connect\w*|repair\w*|correct\w*|protect\w*|pipe|odu)\b/.test(
      text,
    )
  ) {
    return true;
  }
  if (/^\s*linesets?\b/i.test(titleText)) return true;
  return false;
}

/**
 * True when installed-systems + startup-verification gates should fire.
 * Visit mode is handled separately by the closeout-mode branch.
 */
export function requiresStartupAndInstalledSystemGates(input: {
  closeoutMode?: string | null;
  title?: string | null;
  summary?: string | null;
}): boolean {
  if (input.closeoutMode === "visit") return false;
  return !isPrepOrRoughInVisit(input.title, input.summary);
}
