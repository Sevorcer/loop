/**
 * Combine stored manual decisions with live matcher results (#32 / #8). Pure.
 */

import type {
  DriveManualFile,
  InstalledSystemManual,
  InstalledSystemManualsView,
  ManualLinkSource,
  ManualLinkStatus,
  ManualMatch,
  ManualMatchKind,
  ManualMatchSubject,
} from "../types/manuals";
import { confidenceLevel, matchManualsForSystem } from "./manualMatch";

/** Shape of a stored installed_system_manuals row (see repositories/installedSystemManuals). */
export interface StoredManualLinkLike {
  manualId: string;
  status: ManualLinkStatus;
  source: ManualLinkSource;
  kind: ManualMatchKind;
  confidence: number;
  reason: string;
  decidedAt: string;
  manual: DriveManualFile | null;
}

export const MAX_SUGGESTIONS = 5;

function manualSummary(file: DriveManualFile): InstalledSystemManual["manual"] {
  return {
    id: file.id,
    name: file.name,
    webViewLink: file.webViewLink,
    docType: file.docType,
    manufacturer: file.manufacturer,
    models: file.models,
    folderPath: file.folderPath,
    mimeType: file.mimeType,
    portalEligible: file.portalEligible === true,
    status: file.status,
  };
}

export function fromStoredLink(link: StoredManualLinkLike): InstalledSystemManual | null {
  if (!link.manual) return null;
  return {
    manual: manualSummary(link.manual),
    status: link.status,
    source: link.source,
    kind: link.kind,
    confidence: link.confidence,
    level: confidenceLevel(link.confidence),
    reason: link.reason,
    decidedAt: link.decidedAt,
  };
}

function fromMatch(match: ManualMatch, file: DriveManualFile): InstalledSystemManual {
  return {
    manual: manualSummary(file),
    status: "match",
    source: "live",
    kind: match.kind,
    confidence: match.confidence,
    level: match.level,
    reason: match.reason,
    decidedAt: null,
  };
}

const LINKED_ORDER = { confirmed: 0, auto_linked: 1 } as const;

/**
 * Split stored decisions + live matches into what the system card shows.
 * Pure apart from its inputs — exported for tests and for #8.
 */
export function composeSystemManuals(
  stored: StoredManualLinkLike[],
  matches: ManualMatch[],
  files: DriveManualFile[],
): Pick<InstalledSystemManualsView, "linked" | "suggestions" | "rejectedCount"> {
  const byId = new Map(files.map((f) => [f.id, f]));
  const decided = new Set(stored.map((s) => s.manualId));

  const linked = stored
    .filter((s) => s.status === "confirmed" || s.status === "auto_linked")
    .map(fromStoredLink)
    .filter((m): m is InstalledSystemManual => !!m)
    .sort(
      (a, b) =>
        LINKED_ORDER[a.status as keyof typeof LINKED_ORDER] - LINKED_ORDER[b.status as keyof typeof LINKED_ORDER] ||
        b.confidence - a.confidence,
    );

  const storedSuggestions = stored
    .filter((s) => s.status === "suggested")
    .map(fromStoredLink)
    .filter((m): m is InstalledSystemManual => !!m);

  const liveSuggestions = matches
    .filter((m) => !decided.has(m.manualId) && byId.has(m.manualId))
    .map((m) => fromMatch(m, byId.get(m.manualId)!));

  const suggestions = [...storedSuggestions, ...liveSuggestions]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS);

  return {
    linked,
    suggestions,
    rejectedCount: stored.filter((s) => s.status === "rejected").length,
  };
}


export const TECH_PANEL_MAX_MANUALS = 3;

/**
 * #8: what the job Technical data panel shows per system — linked manuals
 * first, then the best possible matches (only medium/high once something is
 * linked), capped at three.
 */
export function driveManualsForTechnicalPanel(
  subject: ManualMatchSubject,
  stored: StoredManualLinkLike[],
  files: DriveManualFile[],
): InstalledSystemManual[] {
  const { linked, suggestions } = composeSystemManuals(stored, matchManualsForSystem(subject, files), files);
  const extra = linked.length > 0 ? suggestions.filter((s) => s.level !== "low").slice(0, 1) : suggestions.slice(0, 2);
  return [...linked, ...extra].slice(0, TECH_PANEL_MAX_MANUALS);
}
