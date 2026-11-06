/** Request body for POST /api/inventory/pars. */

import { parValuesProblem } from "./parRules";

export interface ParWrite {
  itemId: string;
  minQty: number | null;
  maxQty: number | null;
}

export interface ParsedParBody {
  locationId: string;
  rows: ParWrite[];
  problems: string[];
}

function quantity(value: unknown): number | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parseParBody(body: Record<string, unknown>): ParsedParBody {
  const problems: string[] = [];
  const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
  if (!locationId) problems.push("locationId is required.");

  if (!Array.isArray(body.rows)) {
    return { locationId, rows: [], problems: [...problems, "rows must be a list."] };
  }
  if (body.rows.length === 0) problems.push("Nothing to save.");
  if (body.rows.length > 500) problems.push("Save fewer rows at a time.");

  const rows: ParWrite[] = [];
  const seen = new Set<string>();
  for (const entry of body.rows) {
    if (!entry || typeof entry !== "object") {
      problems.push("Each row needs an item.");
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemId = typeof record.itemId === "string" ? record.itemId.trim() : "";
    if (!itemId) {
      problems.push("Each row needs an item.");
      continue;
    }
    if (seen.has(itemId)) {
      problems.push("Each item can only be saved once.");
      continue;
    }
    seen.add(itemId);
    const minQty = quantity(record.minQty);
    const maxQty = quantity(record.maxQty);
    if (minQty === undefined || maxQty === undefined) {
      problems.push("Use a number, or leave it blank.");
      continue;
    }
    const problem = parValuesProblem(minQty, maxQty);
    if (problem) problems.push(problem);
    rows.push({ itemId, minQty, maxQty });
  }

  return { locationId, rows, problems };
}
