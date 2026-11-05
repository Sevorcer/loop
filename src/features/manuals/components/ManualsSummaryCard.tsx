"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { useDriveManuals } from "../state/DriveManualsProvider";
import { manufacturerCounts } from "../utils/manualList";

/**
 * Company Brain entry point for the manuals library: a real card with the
 * library size and top brands, so the manuals are visible without hunting
 * for a text link. Must render inside DriveManualsProvider.
 */
export function ManualsSummaryCard() {
  const { snapshot } = useDriveManuals();
  const files = useMemo(() => snapshot?.files ?? [], [snapshot]);
  const brands = useMemo(() => manufacturerCounts(files), [files]);
  const topBrands = brands.slice(0, 4);

  return (
    <Link href={ROUTE_BUILDERS.COMPANY_BRAIN_MANUALS()} className="block">
      <SurfaceCard className="transition-colors hover:border-white/20">
        <div className="flex items-center gap-4 p-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
            <BookOpen className="h-5 w-5 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-white">
              {files.length > 0 ? `Manuals · ${files.length}` : "Manuals"}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-400">
              {topBrands.length > 0
                ? topBrands.map((entry) => `${entry.manufacturer} · ${entry.count}`).join(" · ")
                : "Install guides, service manuals and field references"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-violet-300">
            Open
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </SurfaceCard>
    </Link>
  );
}
