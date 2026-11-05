import Link from "next/link";

import { cn } from "@/lib/utils";

import { buildCatalogHref, type CatalogFacet, type FlatCategory } from "../utils/catalogView";

interface CategorySidebarProps {
  baseHref: string;
  categories: FlatCategory[];
  counts: Map<string, number>;
  selectedId: string | null;
  current: { q?: string | null; facet?: CatalogFacet };
}

/** Category tree (server-rendered links; selection lives in ?category=). */
export function CategorySidebar({ baseHref, categories, counts, selectedId, current }: CategorySidebarProps) {
  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-11 items-center justify-between gap-2 rounded-atlas-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] lg:min-h-0",
      active ? "status-info" : "text-muted hover:bg-surface-elevated hover:text-primary",
    );

  return (
    <nav aria-label="Categories">
      <ul className="space-y-0.5">
        <li>
          <Link
            href={buildCatalogHref(baseHref, current, { category: null })}
            aria-current={selectedId === null ? "page" : undefined}
            className={itemClass(selectedId === null)}
          >
            All categories
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={buildCatalogHref(baseHref, current, { category: category.id })}
              aria-current={selectedId === category.id ? "page" : undefined}
              className={itemClass(selectedId === category.id)}
            >
              <span className={cn("truncate", INDENT[Math.min(category.depth, 3)])}>{category.name}</span>
              <span className="text-xs tabular-nums">{counts.get(category.id) ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const INDENT = ["", "pl-4", "pl-8", "pl-12"] as const;
