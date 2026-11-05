/**
 * Copilot manual auto-match (#8). Pure.
 *
 * When equipment is entered (or its brand/model changes), Copilot runs the
 * #32 matcher and decides, per manual:
 *   auto-link  — model-level match at or above the threshold (default 0.90)
 *   suggest    — model-level match from 0.60 up to the threshold
 *   (nothing)  — brand-only guides stay live suggestions, never stored
 * Each decision carries the matcher's plain-English reason.
 *
 * COPILOT_MANUAL_AUTOLINK_THRESHOLD can raise the bar (0.90–1.00). The
 * database refuses auto-links below 0.90 regardless.
 */

import type { ManualMatch } from "@/features/manuals/types/manuals";

export const AUTO_LINK_FLOOR = 0.9;
export const SUGGEST_FLOOR = 0.6;
export const MAX_STORED_PER_SYSTEM = 5;

export function autoLinkThreshold(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.COPILOT_MANUAL_AUTOLINK_THRESHOLD);
  if (!Number.isFinite(raw) || raw <= 0) return AUTO_LINK_FLOOR;
  return Math.min(1, Math.max(AUTO_LINK_FLOOR, raw));
}

export interface AutoMatchItem {
  manual_id: string;
  status: "auto_linked" | "suggested";
  match_kind: "model_exact" | "model_family";
  confidence: number;
  reason: string;
}

export interface AutoMatchSummary {
  action: "linked" | "suggested" | "none";
  manualId: string | null;
  confidence: number | null;
  /** One line for the UI / API response. */
  reason: string;
}

export interface AutoMatchPlan {
  items: AutoMatchItem[];
  summary: AutoMatchSummary;
}

export function planManualAutoMatch(
  matches: ManualMatch[],
  options: { threshold?: number; manualName?: (id: string) => string | undefined } = {},
): AutoMatchPlan {
  const threshold = Math.max(AUTO_LINK_FLOOR, options.threshold ?? AUTO_LINK_FLOOR);
  const modelLevel = matches
    .filter((m) => (m.kind === "model_exact" || m.kind === "model_family") && m.confidence >= SUGGEST_FLOOR)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_STORED_PER_SYSTEM);

  const items: AutoMatchItem[] = modelLevel.map((m) => ({
    manual_id: m.manualId,
    status: m.confidence >= threshold ? "auto_linked" : "suggested",
    match_kind: m.kind as "model_exact" | "model_family",
    confidence: Number(Math.min(1, m.confidence).toFixed(3)),
    reason: m.reason.slice(0, 500),
  }));

  const top = items[0];
  const name = (id: string) => options.manualName?.(id) ?? "a Drive manual";
  if (top?.status === "auto_linked") {
    return {
      items,
      summary: {
        action: "linked",
        manualId: top.manual_id,
        confidence: top.confidence,
        reason: `Linked ${name(top.manual_id)} automatically (${Math.round(top.confidence * 100)}%): ${top.reason}`,
      },
    };
  }
  if (top) {
    return {
      items,
      summary: {
        action: "suggested",
        manualId: top.manual_id,
        confidence: top.confidence,
        reason: `Suggested ${name(top.manual_id)} for office review (${Math.round(top.confidence * 100)}%): ${top.reason}`,
      },
    };
  }
  const brandGuides = matches.filter((m) => m.kind === "manufacturer").length;
  return {
    items,
    summary: {
      action: "none",
      manualId: null,
      confidence: null,
      reason: brandGuides
        ? `No model-specific manual in Drive yet; ${brandGuides} brand guide${brandGuides === 1 ? "" : "s"} shown as possible matches.`
        : "No manual in Drive matches this brand or model yet.",
    },
  };
}
