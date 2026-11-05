/**
 * Parse a Drive file name (and its folder path) into a manufacturer,
 * model-number tokens and a document type. Pure — no I/O.
 *
 * File names in Collin's Drive look like:
 *   "Coleman_R454B_Install_Quick_Reference.pdf"
 *   "Trane / American Standard / Ameristar — Field Reference"
 *   "AIO Wall Mounted Pro (Gen 2) Installation Guide - Ephoca (V 5.0)"
 *   "01. Concealed Ducted IOM.pdf"
 * and, as the library grows, model-named manuals such as
 *   "MSZ-GL09NA_Installation_Manual.pdf" or "Lennox ML14XC1 IOM.pdf".
 */

import type { ManualDocType, ParsedManualName } from "../types/manuals";

/** Canonical brand → aliases (lowercase, word-ish). Longest alias wins. */
export const MANUFACTURER_ALIASES: Record<string, string[]> = {
  "American Standard": ["american standard", "american-standard", "american_standard", "amstd"],
  Ameristar: ["ameristar"],
  Amana: ["amana"],
  Aprilaire: ["aprilaire"],
  Bosch: ["bosch"],
  Bryant: ["bryant"],
  Carrier: ["carrier"],
  Coleman: ["coleman"],
  Daikin: ["daikin"],
  Ecobee: ["ecobee"],
  Ephoca: ["ephoca"],
  Fujitsu: ["fujitsu"],
  Goodman: ["goodman"],
  Gree: ["gree"],
  Heil: ["heil"],
  "High-Light": ["high-light", "highlight", "high light"],
  Hisense: ["hisense"],
  Honeywell: ["honeywell"],
  Lennox: ["lennox"],
  LG: ["lg"],
  Lochinvar: ["lochinvar"],
  Midea: ["midea"],
  Mitsubishi: ["mitsubishi", "mitsubishi electric", "mitsubishi_electric"],
  Napoleon: ["napoleon"],
  Navien: ["navien"],
  Payne: ["payne"],
  Reznor: ["reznor"],
  Rheem: ["rheem"],
  Rinnai: ["rinnai"],
  Ruud: ["ruud"],
  SpacePak: ["spacepak", "space pak", "space-pak"],
  Tempstar: ["tempstar"],
  Trane: ["trane"],
  Unico: ["unico"],
  "Weil-McLain": ["weil-mclain", "weil mclain"],
  York: ["york"],
};

/** Equivalent names for matching ("Mitsubishi Electric" = "Mitsubishi"). */
export function canonicalManufacturer(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!v) return null;
  for (const [canonical, aliases] of Object.entries(MANUFACTURER_ALIASES)) {
    if (canonical.toLowerCase() === v || aliases.includes(v)) return canonical;
  }
  // "Mitsubishi Electric Trane HVAC" etc. — first alias that appears as a word.
  const found = findManufacturers(v);
  return found[0] ?? value.trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** All brands named in a string, in order of first appearance. */
export function findManufacturers(text: string): string[] {
  // "SpacePakLoadForm" → "Space Pak Load Form" so glued CamelCase brands match.
  const spaced = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  const haystack = ` ${spaced.toLowerCase().replace(/[_]+/g, " ")} `;
  const hits: Array<{ brand: string; at: number }> = [];
  for (const [canonical, aliases] of Object.entries(MANUFACTURER_ALIASES)) {
    let best = -1;
    for (const alias of aliases) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}(?=[^a-z0-9]|$)`);
      const m = re.exec(haystack);
      if (m && (best === -1 || m.index < best)) best = m.index;
    }
    if (best >= 0) hits.push({ brand: canonical, at: best });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.brand);
}

/** Tokens that look like model numbers but are refrigerants, dates, etc. */
const NOT_A_MODEL = [
  /^R-?\d{2,3}[A-Z]?$/, // R454B, R-410A, R32
  /^A2L$/,
  /^(19|20)\d{2}$/, // years
  /^\d{1,2}-\d{1,2}-\d{2,4}$/, // dates
  /^V\d+(\.\d+)?$/, // version "V5.0"
  /^GEN\d*$/,
  /^IOM$/,
  /^HP$/,
  /^HD$/,
  /^IDS$/, // Bosch product line, kept as text, not a model
  /^\d+$/, // bare numbers
];

/**
 * Model-number-like tokens: at least 4 characters, at least one letter and
 * one digit, may contain dashes / slashes (e.g. "MSZ-GL09NA", "ML14XC1",
 * "4TTR6036J1000A", "GCS16-024-50-4P").
 */
export function findModelTokens(text: string): string[] {
  const cleaned = text.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, "");
  const raw = cleaned.split(/[\s_,;()[\]{}]+|(?<=\w)\.(?=\s|$)/);
  const out: string[] = [];
  for (const piece of raw) {
    const token = piece.replace(/^[-/.]+|[-/.]+$/g, "").toUpperCase();
    if (token.length < 4 || token.length > 30) continue;
    if (!/[A-Z]/.test(token) || !/\d/.test(token)) continue;
    if (NOT_A_MODEL.some((re) => re.test(token))) continue;
    // "HIGHLIGHT-INSTALL-725": a dash-joined phrase with a plain word of 5+
    // letters is a title, not a model number.
    if (token.split(/[-/.]/).some((seg) => /^[A-Z]{5,}$/.test(seg))) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

const DOC_TYPE_RULES: Array<[ManualDocType, RegExp]> = [
  ["iom", /\biom\b|installation[, ]+operation|install[, ]+operat/i],
  ["service", /service (manual|parameters?)|\bservice\b|troubleshoot/i],
  ["spec_sheet", /spec(ification)?s?[ _-]?sheet|submittal|data ?sheet|product data/i],
  ["wiring", /wiring|schematic/i],
  ["quick_reference", /quick[ _-]?reference|quick[ _-]?start/i],
  ["field_reference", /field (reference|primer)|field[ _-]reference/i],
  ["user", /user(-| )?manual|owner'?s manual|operation manual|user guide/i],
  ["guide", /field fixes|issues and resolutions|troubleshooting guide/i],
  ["install", /install(ation)?/i],
  ["form", /template|form\b|loadform|load[ _-]?form|packet|checklist|rules/i],
  ["guide", /guide|reference|primer|manual/i],
];

/** Document type from the name. First matching rule wins (order above). */
export function detectDocType(name: string): ManualDocType {
  const text = name.replace(/_/g, " ");
  for (const [type, re] of DOC_TYPE_RULES) {
    if (re.test(text)) return type;
  }
  return "other";
}

export function parseManualName(name: string, folderPath = ""): ParsedManualName {
  const fromName = findManufacturers(name);
  const fromFolder = folderPath ? findManufacturers(folderPath) : [];
  const manufacturers = [...fromName, ...fromFolder.filter((b) => !fromName.includes(b))];
  return {
    manufacturer: manufacturers[0] ?? null,
    manufacturers,
    models: findModelTokens(name),
    docType: detectDocType(name),
  };
}

/** Uppercase, alphanumerics only — the comparison form for model numbers. */
export function normalizeModelNumber(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
