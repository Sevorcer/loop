/**
 * Catalog items — the ONE item master (sellable and/or stockable)
 *
 * GET  /api/inventory/items — list (search, categoryId, facet, includeInactive, limit)
 * POST /api/inventory/items — create (optional `cost` block, owner/manager/office only)
 *
 * Roles: catalog_items — select: all internal roles; insert: owner, manager, office.
 * Cost is attached only when the caller may read catalog_item_costs; it is never
 * fetched for tech, dispatch, sales or portal.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag, queryInt, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import type { CatalogItemFilters, CatalogItemInput } from "@/features/inventory/types/catalog";
import { parseCostPayload, parseItemPayload } from "@/features/inventory/utils/itemPayload";
import { hasPermission } from "@/services/authorization";
import { createCatalogItem, listCatalogItems, setItemCost } from "@/services/inventoryCatalog";

const FACETS = new Set(["sellable", "stockable", "both"]);

export async function GET(request: Request) {
  const guard = await requirePermission(request, "catalog_items", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const facet = url.searchParams.get("facet");
  const filters: CatalogItemFilters = {
    search: url.searchParams.get("search") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    facet: facet && FACETS.has(facet) ? (facet as CatalogItemFilters["facet"]) : undefined,
    includeInactive: queryFlag(url, "includeInactive"),
    limit: queryInt(url, "limit"),
  };

  try {
    const items = await listCatalogItems(filters, {
      canSeeCost: hasPermission(guard.ctx.role, "catalog_item_costs", "select"),
    });
    return NextResponse.json({ items });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "catalog_items", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const item = parseItemPayload(body);
  const cost = parseCostPayload(body);
  const problems = [...item.problems, ...cost.problems];
  if (problems.length > 0) return validationError(problems.join(" "));
  if (cost.value && !hasPermission(guard.ctx.role, "catalog_item_costs", "insert")) {
    return validationError("You are not allowed to set item cost.");
  }

  try {
    const created = await createCatalogItem(item.value as CatalogItemInput);
    if (cost.value) await setItemCost(created.id, cost.value, guard.ctx.userId);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
