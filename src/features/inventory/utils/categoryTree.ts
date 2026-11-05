/** Pure helpers for the hierarchical category tree (max depth enforced here, not in the database). */

import type { CatalogCategory } from "../types/catalog";

export const MAX_CATEGORY_DEPTH = 3;

type CategoryNode = Pick<CatalogCategory, "id" | "parentId">;

/** Depth of a category: a root is 1. Returns Infinity if the chain loops. */
export function categoryDepth(id: string, all: readonly CategoryNode[]): number {
  const byId = new Map(all.map((category) => [category.id, category]));
  let depth = 0;
  let cursor: string | null = id;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return Number.POSITIVE_INFINITY;
    seen.add(cursor);
    depth += 1;
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return depth;
}

/** Height of the subtree under `id` (a leaf is 1). */
function subtreeHeight(id: string, all: readonly CategoryNode[]): number {
  const children = all.filter((category) => category.parentId === id);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((child) => subtreeHeight(child.id, all)));
}

/**
 * Returns a problem string if placing `categoryId` (or a new category when null)
 * under `newParentId` would create a cycle or exceed the depth limit.
 */
export function validateCategoryParent(
  categoryId: string | null,
  newParentId: string | null,
  all: readonly CategoryNode[],
): string | null {
  if (newParentId == null) return null;
  if (!all.some((category) => category.id === newParentId)) return "Parent category not found.";
  if (categoryId != null) {
    if (categoryId === newParentId) return "A category cannot be its own parent.";
    // Walk up from the new parent; meeting categoryId means a cycle.
    let cursor: string | null = newParentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === categoryId) return "A category cannot be moved under its own sub-category.";
      seen.add(cursor);
      cursor = all.find((category) => category.id === cursor)?.parentId ?? null;
    }
  }
  const parentDepth = categoryDepth(newParentId, all);
  const ownHeight = categoryId == null ? 1 : subtreeHeight(categoryId, all);
  if (parentDepth + ownHeight > MAX_CATEGORY_DEPTH) {
    return `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep.`;
  }
  return null;
}
