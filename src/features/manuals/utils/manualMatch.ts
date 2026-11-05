/**
 * Manual ↔ equipment matcher (#32, reused by #8 Copilot auto-match). Pure.
 *
 * Scores every indexed Drive manual against one installed system:
 *   model_exact   0.97  the system's model number is in the file name
 *   model_family  0.65–0.85  the file names a model series / base model
 *   manufacturer  0.35–0.45  same brand, general reference (not model-specific)
 * A model hit on a file whose brand conflicts with the system is capped at 0.6.
 */

import type {
  DriveManualFile,
  ManualMatch,
  ManualMatchKind,
  ManualMatchSubject,
  MatchConfidenceLevel,
} from "../types/manuals";
import { MANUAL_DOC_TYPE_LABELS } from "../types/manuals";
import { canonicalManufacturer, findManufacturers, normalizeModelNumber } from "./parseManualName";

export const MATCH_THRESHOLDS = { high: 0.9, medium: 0.6, minimumShown: 0.3 } as const;

export function confidenceLevel(confidence: number): MatchConfidenceLevel {
  if (confidence >= MATCH_THRESHOLDS.high) return "high";
  if (confidence >= MATCH_THRESHOLDS.medium) return "medium";
  return "low";
}

const PLACEHOLDER_MODELS = new Set(["", "UNKNOWN", "NA", "NONE", "TBD", "PENDING", "NOMODEL"]);

function systemBrand(subject: ManualMatchSubject): string | null {
  const direct = canonicalManufacturer(subject.manufacturer ?? null);
  if (direct) return direct;
  return subject.systemName ? (findManufacturers(subject.systemName)[0] ?? null) : null;
}

function fileBrands(file: Pick<DriveManualFile, "manufacturer" | "manufacturerOverride" | "parsedManufacturers">): string[] {
  if (file.manufacturerOverride) return [canonicalManufacturer(file.manufacturerOverride) ?? file.manufacturerOverride];
  const brands = file.parsedManufacturers.length
    ? file.parsedManufacturers
    : file.manufacturer
      ? [file.manufacturer]
      : [];
  return brands.map((b) => canonicalManufacturer(b) ?? b);
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

const DOC_BONUS: Partial<Record<DriveManualFile["docType"], number>> = {
  install: 0.05,
  iom: 0.05,
  service: 0.05,
  quick_reference: 0.04,
  field_reference: 0.03,
  spec_sheet: 0.02,
};

type MatchableFile = Pick<
  DriveManualFile,
  "id" | "name" | "docType" | "models" | "manufacturer" | "manufacturerOverride" | "parsedManufacturers" | "status"
>;

function scoreModel(sysModel: string, file: MatchableFile): { kind: ManualMatchKind; confidence: number; token: string } | null {
  let best: { kind: ManualMatchKind; confidence: number; token: string } | null = null;
  const consider = (kind: ManualMatchKind, confidence: number, token: string) => {
    if (!best || confidence > best.confidence) best = { kind, confidence, token };
  };
  for (const raw of file.models) {
    const token = normalizeModelNumber(raw);
    if (token.length < 4) continue;
    if (token === sysModel) {
      consider("model_exact", 0.97, raw);
      continue;
    }
    if (token.length >= 5 && sysModel.startsWith(token)) {
      // File covers a series, e.g. "ML14XC" for "ML14XC1-036".
      consider("model_family", Math.min(0.85, 0.65 + 0.03 * (token.length - 4)), raw);
      continue;
    }
    if (sysModel.length >= 6 && token.startsWith(sysModel)) {
      consider("model_family", 0.75, raw);
      continue;
    }
    const prefix = commonPrefixLength(token, sysModel);
    if (prefix >= 6 && prefix >= 0.7 * Math.min(token.length, sysModel.length)) {
      consider("model_family", 0.65, raw);
    }
  }
  return best;
}

export function matchManualsForSystem(subject: ManualMatchSubject, files: MatchableFile[]): ManualMatch[] {
  const brand = systemBrand(subject);
  const sysModel = normalizeModelNumber(subject.modelNumber);
  const modelUsable = sysModel.length >= 4 && !PLACEHOLDER_MODELS.has(sysModel);
  const out: ManualMatch[] = [];

  for (const file of files) {
    if (file.status !== "active") continue;
    const brands = fileBrands(file);
    const brandMatches = !!brand && brands.includes(brand);
    const brandConflicts = !!brand && brands.length > 0 && !brandMatches;

    const model = modelUsable ? scoreModel(sysModel, file) : null;
    if (model) {
      const confidence = brandConflicts ? Math.min(model.confidence, 0.6) : model.confidence;
      const what = model.kind === "model_exact" ? `Model ${model.token} is in the file name` : `File covers the ${model.token} series`;
      const brandNote = brandConflicts ? ` (but the file is for ${brands.join("/")}, system is ${brand})` : brandMatches ? ` (${brand})` : "";
      out.push({
        manualId: file.id,
        kind: model.kind,
        confidence: Number(confidence.toFixed(3)),
        level: confidenceLevel(confidence),
        reason: `${what}${brandNote}.`,
      });
      continue;
    }

    if (brandMatches) {
      const confidence = Math.min(0.45, 0.35 + (DOC_BONUS[file.docType] ?? 0));
      out.push({
        manualId: file.id,
        kind: "manufacturer",
        confidence: Number(confidence.toFixed(3)),
        level: confidenceLevel(confidence),
        reason: `Same brand (${brand}) — ${MANUAL_DOC_TYPE_LABELS[file.docType].toLowerCase()}, not model-specific.`,
      });
    }
  }

  return out
    .filter((m) => m.confidence >= MATCH_THRESHOLDS.minimumShown)
    .sort((a, b) => b.confidence - a.confidence || a.manualId.localeCompare(b.manualId));
}
