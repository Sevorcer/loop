"use client";

import { CATALOG_FACETS, type CatalogFacet } from "../utils/catalogView";
import { SearchParamInput, SearchParamSelect } from "./SearchParamControls";

const FACET_LABELS: Record<CatalogFacet, string> = {
  all: "All active items",
  sellable: "Sellable",
  stockable: "Stockable",
  both: "Sellable + stockable",
  inactive: "Inactive",
};

/** Small client island: type-ahead search and facet filter, both written to the URL. */
export function CatalogFilters({ search, facet }: { search: string; facet: CatalogFacet }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <SearchParamInput param="q" label="Search catalog" placeholder="Search name, SKU, brand, model…" initialValue={search} />
      <SearchParamSelect
        param="facet"
        label="Show"
        value={facet}
        clearValue="all"
        options={CATALOG_FACETS.map((value) => ({ value, label: FACET_LABELS[value] }))}
      />
    </div>
  );
}
