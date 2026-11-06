import "server-only";

import type {
  KitHeaderPatch,
  KitLineInput,
  KitTemplate,
  KitTemplateSummary,
} from "@/features/inventory/types/kits";
import {
  isUuid,
  normalizeKitHeader,
  normalizeKitLines,
  validateKitName,
  type RuleResult,
} from "@/features/inventory/utils/kitRules";
import { getKitTemplate, listKitSummaries, saveKitTemplate } from "@/repositories/kitTemplates";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(): never {
  throw Object.assign(new Error("Kit not found."), { status: 404 });
}

function unwrap<T>(result: RuleResult<T>): T {
  if (!result.ok) badRequest(result.message);
  return result.value;
}

export async function listKits(includeArchived = false): Promise<KitTemplateSummary[]> {
  return listKitSummaries(includeArchived);
}

export async function getKit(id: string): Promise<KitTemplate> {
  if (!isUuid(id)) notFound();
  const kit = await getKitTemplate(id);
  if (!kit) notFound();
  return kit;
}

export interface CreateKitInput {
  name: unknown;
  description?: unknown;
  category?: unknown;
  lines?: unknown;
  /** Copy another kit's lines (and, unless overridden, its category/description). */
  copyFromId?: unknown;
}

export async function createKit(input: CreateKitInput): Promise<KitTemplate> {
  const name = unwrap(validateKitName(input.name));
  const headerSource: Record<string, unknown> = { name };
  if (input.description !== undefined) headerSource.description = input.description;
  if (input.category !== undefined) headerSource.category = input.category;
  const header: KitHeaderPatch = unwrap(normalizeKitHeader(headerSource));

  let lines: KitLineInput[] | undefined;
  if (input.copyFromId !== undefined && input.copyFromId !== null) {
    if (input.lines !== undefined) badRequest("Copy a kit or send lines, not both.");
    if (!isUuid(input.copyFromId)) badRequest("copyFromId must be a kit id.");
    const source = await getKitTemplate(input.copyFromId);
    if (!source) notFound();
    lines = source.lines.map((line) => ({
      catalogItemId: line.catalogItemId,
      quantity: line.quantity,
      isOptional: line.isOptional,
      notes: line.notes,
    }));
    if (input.category === undefined) header.category = source.category;
    if (input.description === undefined) header.description = source.description;
  } else if (input.lines !== undefined) {
    lines = unwrap(normalizeKitLines(input.lines));
  }

  const id = await saveKitTemplate({ id: null, header, lines });
  return getKit(id);
}

export interface UpdateKitInput {
  header: Record<string, unknown>;
  /** Undefined leaves lines untouched; an array replaces them. */
  lines?: unknown;
}

export async function updateKit(id: string, input: UpdateKitInput): Promise<KitTemplate> {
  if (!isUuid(id)) notFound();
  const header = unwrap(normalizeKitHeader(input.header));
  const lines = input.lines === undefined ? undefined : unwrap(normalizeKitLines(input.lines));
  if (Object.keys(header).length === 0 && lines === undefined) badRequest("Nothing to change.");

  await saveKitTemplate({ id, header, lines });
  return getKit(id);
}
