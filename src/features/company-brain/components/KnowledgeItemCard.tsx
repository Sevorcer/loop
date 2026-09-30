"use client";

import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  Tag,
} from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import type { KnowledgeItem } from "../types/knowledgeItem";
import {
  formatRelativeDate,
  getKnowledgeStatusLabel,
  getKnowledgeTypeLabel,
} from "../utils/knowledgeUtils";

interface KnowledgeItemCardProps {
  item: KnowledgeItem;
  relationshipCount?: number;
  onClick?: () => void;
}

const statusStyles: Record<
  KnowledgeItem["status"],
  { badge: string; dot: string }
> = {
  draft: {
    badge: "border-slate-700 bg-white/5 text-slate-400",
    dot: "bg-slate-500",
  },
  reviewed: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    dot: "bg-blue-400",
  },
  published: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  improved: {
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    dot: "bg-violet-400",
  },
  archived: {
    badge: "border-slate-600/30 bg-slate-800/40 text-slate-500",
    dot: "bg-slate-600",
  },
};

const typeStyles: Record<
  KnowledgeItem["knowledgeType"],
  { accent: string; icon: string }
> = {
  sop: { accent: "border-l-blue-500", icon: "text-blue-400" },
  installation_guide: { accent: "border-l-cyan-500", icon: "text-cyan-400" },
  service_bulletin: { accent: "border-l-amber-500", icon: "text-amber-400" },
  troubleshooting: { accent: "border-l-red-500", icon: "text-red-400" },
  safety_procedure: { accent: "border-l-orange-500", icon: "text-orange-400" },
  best_practice: { accent: "border-l-emerald-500", icon: "text-emerald-400" },
  policy: { accent: "border-l-violet-500", icon: "text-violet-400" },
  training: { accent: "border-l-sky-500", icon: "text-sky-400" },
  faq: { accent: "border-l-slate-400", icon: "text-slate-400" },
};

export function KnowledgeItemCard({
  item,
  relationshipCount = 0,
  onClick,
}: KnowledgeItemCardProps) {
  const status = statusStyles[item.status];
  const type = typeStyles[item.knowledgeType];

  return (
    <SurfaceCard
      className={[
        "border-l-2 transition-all duration-200",
        type.accent,
        onClick
          ? "cursor-pointer hover:bg-white/[0.07] hover:shadow-[0_14px_36px_rgba(0,0,0,0.32)]"
          : "",
      ].join(" ")}
    >
      <div
        className="p-5"
        onClick={onClick}
        // F14: full-card tap target on phones; keyboard-operable like the
        // atlas mobile table cards.
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(event) => {
          if (!onClick) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
      >
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex-shrink-0">
              <BookOpen className={`h-4 w-4 ${type.icon}`} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-snug text-white">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {getKnowledgeTypeLabel(item.knowledgeType)} · v{item.version}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={[
              "flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              status.badge,
            ].join(" ")}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {getKnowledgeStatusLabel(item.status)}
          </span>
        </div>

        {/* Summary */}
        <p className="mb-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
          {item.summary}
        </p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {item.tags.length > 4 && (
              <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-500">
                +{item.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Updated {formatRelativeDate(item.updatedAt)}
            </span>
            {relationshipCount > 0 && (
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                {relationshipCount} link{relationshipCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <span className="flex items-center gap-1 text-xs text-slate-500">
            <FileText className="h-3 w-3" />
            {item.owner}
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ------------------------------------------------------------------
// Compact variant — used in contextual surfaces (jobs, dispatch, etc.)
// ------------------------------------------------------------------

interface KnowledgeItemCompactCardProps {
  item: KnowledgeItem;
  onClick?: () => void;
}

export function KnowledgeItemCompactCard({
  item,
  onClick,
}: KnowledgeItemCompactCardProps) {
  const type = typeStyles[item.knowledgeType];
  const status = statusStyles[item.status];

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-all duration-200",
        onClick
          ? "cursor-pointer hover:bg-white/[0.07]"
          : "",
      ].join(" ")}
      onClick={onClick}
    >
      <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${type.icon}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.title}</p>
        <p className="text-xs text-slate-500">
          {getKnowledgeTypeLabel(item.knowledgeType)}
        </p>
      </div>
      <span
        className={[
          "flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
          status.badge,
        ].join(" ")}
      >
        {getKnowledgeStatusLabel(item.status)}
      </span>
    </div>
  );
}
