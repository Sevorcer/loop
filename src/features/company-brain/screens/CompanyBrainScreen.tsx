"use client";

import { useState } from "react";

import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { KnowledgeItemCard } from "../components/KnowledgeItemCard";
import { useCompanyBrain } from "../state/CompanyBrainProvider";
import type { KnowledgeItem, KnowledgeType } from "../types/knowledgeItem";
import { resolveCompanyBrainUiState } from "../utils/uiState";
import {
  formatRelativeDate,
  getKnowledgeTypeLabel,
  getKnowledgeUsageEventLabel,
  getRecentUsage,
} from "../utils/knowledgeUtils";

// ------------------------------------------------------------------
// Knowledge Type Filter Tabs
// ------------------------------------------------------------------

const TYPE_FILTERS: { key: KnowledgeType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sop", label: "SOPs" },
  { key: "troubleshooting", label: "Troubleshooting" },
  { key: "installation_guide", label: "Install Guides" },
  { key: "service_bulletin", label: "Bulletins" },
  { key: "safety_procedure", label: "Safety" },
  { key: "best_practice", label: "Best Practices" },
  { key: "policy", label: "Policies" },
  { key: "training", label: "Training" },
];

// ------------------------------------------------------------------
// Company Brain Screen
// ------------------------------------------------------------------

export function CompanyBrainScreen() {
  const { snapshot, searchKnowledge, getRelationshipsForItem, loading, error } =
    useCompanyBrain();

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | "all">("all");
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);

  // Keep selectedItem in sync after provider refreshes
  const syncedSelectedItem = selectedItem
    ? (snapshot.items.find((i) => i.id === selectedItem.id) ?? selectedItem)
    : null;

  const { metrics } = snapshot;

  // Derive filtered results
  const searchResults = searchKnowledge({
    text: searchText || undefined,
    types: typeFilter !== "all" ? [typeFilter] : undefined,
    statuses: ["draft", "reviewed", "published", "improved"],
  });

  const recentUsage = getRecentUsage(snapshot.usage, 7);

  const isSearchActive = searchText.trim().length > 0 || typeFilter !== "all";
  const uiState = resolveCompanyBrainUiState({
    loading,
    error,
    itemCount: snapshot.items.length,
  });

  if (uiState === "loading") {
    return <LoadingState message="Loading company knowledge..." />;
  }

  if (uiState === "error") {
    return (
      <ErrorState
        title="Unable to load Company Brain"
        description={
          error ??
          "We couldn't load Company Brain right now. Please try again in a moment."
        }
      />
    );
  }

  if (uiState === "empty") {
    return (
      <EmptyState
        title="No company knowledge is available yet"
        description="Knowledge items will appear here once published."
        icon={<Brain className="h-5 w-5" />}
        action={
          <PermissionGuard table="knowledge_items" action="insert">
            <Link href={ROUTE_BUILDERS.COMPANY_BRAIN_NEW()}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Knowledge
              </Button>
            </Link>
          </PermissionGuard>
        }
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Hero ── */}
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 sm:inline-flex">
              <Brain className="h-3.5 w-3.5" />
              Company Brain · Organizational Knowledge
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Company Brain
              </h2>
              <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-slate-400 sm:block">
                Every lesson learned by the company becomes reusable operational
                knowledge. Company Brain captures knowledge once and makes it
                available everywhere — on jobs, in dispatch, on installed
                systems, and during live operations.{" "}
                <span className="font-medium text-slate-200">
                  Knowledge is an operational asset.
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 sm:items-end">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                icon={CheckCircle2}
                value={String(metrics.published)}
                label="Published"
                variant="success"
              />
              <MetricCard
                icon={TrendingUp}
                value={String(metrics.improved)}
                label="Improved"
                variant="info"
              />
              <MetricCard
                icon={Clock}
                value={String(metrics.draft + metrics.reviewed)}
                label="In Review"
                variant="warning"
              />
              <MetricCard
                icon={BookOpen}
                value={String(metrics.totalItems)}
                label="Total Items"
                variant="neutral"
              />
            </div>

            <PermissionGuard table="knowledge_items" action="insert">
              <Link href={ROUTE_BUILDERS.COMPANY_BRAIN_NEW()}>
                <Button className="gap-2 border border-violet-500/20 bg-gradient-to-r from-violet-500/80 to-purple-600 text-white hover:from-violet-500 hover:to-purple-700">
                  <Plus className="h-4 w-4" />
                  New Knowledge
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Search ── */}
      <SurfaceCard>
        <div className="p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2 sm:mb-4">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-semibold text-white">
              Search Organizational Knowledge
            </p>
          </div>
          <p className="mb-3 hidden text-xs text-slate-500 sm:mb-4 sm:block">
            Ask an operational question — not a file path. Try:{" "}
            <span className="text-slate-400">
              &ldquo;mini-split startup&rdquo;, &ldquo;breaker sizing&rdquo;, &ldquo;hrv commissioning&rdquo;,{" "}
              &ldquo;e1 fault&rdquo;, &ldquo;permit policy&rdquo;
            </span>
          </p>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="How do I commission an HRV? What breaker does this unit require?"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-violet-500/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-violet-500/30"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key as KnowledgeType | "all")}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  typeFilter === f.key
                    ? "border-violet-500/50 bg-violet-500/20 text-violet-200"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ── Search Results / Knowledge Library ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">
            {isSearchActive
              ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`
              : "Knowledge Library"}
          </h3>
          {isSearchActive && (
            <button
              onClick={() => {
                setSearchText("");
                setTypeFilter("all");
              }}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear filters
            </button>
          )}
        </div>

        {searchResults.length === 0 ? (
          <SurfaceCard>
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Search className="h-8 w-8 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">
                No knowledge found
              </p>
              <p className="max-w-sm text-xs text-slate-600">
                Try a different search term or clear the type filter. Company
                Brain grows as the company learns.
              </p>
            </div>
          </SurfaceCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {searchResults.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                item={item}
                relationshipCount={
                  getRelationshipsForItem(item.id).length
                }
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Knowledge Detail Panel ── */}
      {syncedSelectedItem && (
        <KnowledgeDetailPanel
          item={syncedSelectedItem}
          relationships={getRelationshipsForItem(syncedSelectedItem.id)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* ── Lifecycle Overview ── */}
      <SurfaceCard>
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2 sm:mb-5">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-white">
              Knowledge Lifecycle
            </p>
          </div>
          <p className="mb-4 hidden text-xs text-slate-500 sm:mb-5 sm:block">
            Knowledge evolves over time as the company learns. It does not
            become static forever.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                {
                  status: "draft",
                  label: "Draft",
                  description: "Being created",
                  count: metrics.draft,
                  color: "text-slate-400 border-slate-700 bg-white/5",
                  dot: "bg-slate-500",
                },
                {
                  status: "reviewed",
                  label: "Reviewed",
                  description: "Checked for accuracy",
                  count: metrics.reviewed,
                  color:
                    "text-blue-300 border-blue-500/20 bg-blue-500/10",
                  dot: "bg-blue-400",
                },
                {
                  status: "published",
                  label: "Published",
                  description: "Ready for operations",
                  count: metrics.published,
                  color:
                    "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
                  dot: "bg-emerald-400",
                },
                {
                  status: "improved",
                  label: "Improved",
                  description: "Updated from field learning",
                  count: metrics.improved,
                  color:
                    "text-violet-300 border-violet-500/20 bg-violet-500/10",
                  dot: "bg-violet-400",
                },
                {
                  status: "archived",
                  label: "Archived",
                  description: "Retained but inactive",
                  count: metrics.archived,
                  color: "text-slate-500 border-slate-600/30 bg-slate-800/40",
                  dot: "bg-slate-600",
                },
              ] as const
            ).map((stage) => (
              <div
                key={stage.status}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${stage.color}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${stage.dot}`}
                    />
                    {stage.label}
                  </div>
                  <span className="text-lg font-semibold text-white">
                    {stage.count}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-4 text-slate-500">
                  {stage.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ── Domain Coverage ── */}
      <SurfaceCard>
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2 sm:mb-5">
            <Link2 className="h-4 w-4 text-cyan-400" />
            <p className="text-sm font-semibold text-white">
              Domain Coverage
            </p>
          </div>
          <p className="mb-4 hidden text-xs text-slate-500 sm:mb-5 sm:block">
            Company Brain references operational domains without duplicating
            their data. Knowledge connects to work where it matters.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(
              [
                {
                  domain: "equipment" as const,
                  label: "Equipment",
                  description: "Install guides, fault codes, specifications",
                },
                {
                  domain: "installed_systems" as const,
                  label: "Installed Systems",
                  description: "System-specific troubleshooting and bulletins",
                },
                {
                  domain: "inventory" as const,
                  label: "Inventory",
                  description: "Handling, install instructions, materials",
                },
                {
                  domain: "jobs" as const,
                  label: "Jobs",
                  description: "SOPs, checklists, and job-type procedures",
                },
                {
                  domain: "manufacturers" as const,
                  label: "Manufacturers",
                  description: "Vendor bulletins, specs, warranty policies",
                },
                {
                  domain: "customers" as const,
                  label: "Customers",
                  description: "Customer-specific notes and preferences",
                },
                {
                  domain: "properties" as const,
                  label: "Properties",
                  description: "Site-specific considerations and access notes",
                },
                {
                  domain: "dispatch" as const,
                  label: "Dispatch",
                  description:
                    "Pre-dispatch checklists and crew preparation guides",
                },
              ] as const
            ).map((item) => {
              const count = snapshot.items.filter(
                (ki) =>
                  ki.relatedDomains.includes(item.domain) &&
                  ki.status !== "archived"
              ).length;

              return (
                <div
                  key={item.domain}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {item.label}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-400">
                      {count}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-4 text-slate-500">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </SurfaceCard>

      {/* ── Recent Activity ── */}
      {recentUsage.length > 0 && (
        <SurfaceCard>
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <p className="text-sm font-semibold text-white">
                Recent Knowledge Activity
              </p>
            </div>
            <p className="mb-4 hidden text-xs text-slate-500 sm:block">
              Tracks how knowledge is being used across operations —
              not for analytics, but to understand whether knowledge is helping.
            </p>
            <div className="space-y-1">
              {recentUsage.slice(0, 6).map((usage) => {
                const item = snapshot.items.find(
                  (ki) => ki.id === usage.knowledgeItemId
                );
                if (!item) return null;

                const eventColors: Record<typeof usage.event, string> = {
                  viewed: "bg-slate-500",
                  referenced: "bg-blue-500",
                  linked: "bg-cyan-500",
                  updated: "bg-violet-500",
                };

                return (
                  <div
                    key={usage.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 px-4 py-3"
                  >
                    <div
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${eventColors[usage.event]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">
                        {item.title}
                      </p>
                      {usage.context && (
                        <p className="truncate text-xs text-slate-500">
                          {usage.context}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-slate-400">
                        {getKnowledgeUsageEventLabel(usage.event)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatRelativeDate(usage.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* ── Architecture Note ── */}
      <SurfaceCard>
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-white">
              Architecture — Organizational Knowledge
            </p>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            Company Brain owns organizational knowledge — not documents. The
            defining concept of this domain is that information becomes
            knowledge only when it has been captured, structured, connected, and
            made reusable.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "KnowledgeItem",
                role: "Aggregate Root",
                description:
                  "The canonical unit of organizational knowledge. All other domain objects reference it.",
              },
              {
                label: "KnowledgeRelationship",
                role: "Domain Reference",
                description:
                  "Connects knowledge to operational domains. Company Brain references — it does not own — those domains.",
              },
              {
                label: "Knowledge Lifecycle",
                role: "Draft → Archived",
                description:
                  "Knowledge evolves from Draft through Published and Improved. It does not become stale forever.",
              },
              {
                label: "Knowledge Retrieval",
                role: "Search is contextual",
                description:
                  "Users ask operational questions — not file paths. Company Brain answers where knowledge matters.",
              },
            ].map((node) => (
              <div
                key={node.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  {node.role}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-white">
                  {node.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {node.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

// ------------------------------------------------------------------
// Knowledge Detail Panel
// ------------------------------------------------------------------

function KnowledgeDetailPanel({
  item,
  relationships,
  onClose,
}: {
  item: KnowledgeItem;
  relationships: ReturnType<ReturnType<typeof useCompanyBrain>["getRelationshipsForItem"]>;
  onClose: () => void;
}) {
  return (
    <SurfaceCard className="border border-violet-500/20">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-400">
              {getKnowledgeTypeLabel(item.knowledgeType)} · v{item.version}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {item.title}
            </h3>
            <p className="mt-1.5 text-sm text-slate-400">{item.summary}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <PermissionGuard table="knowledge_items" action="update">
              <Link href={ROUTE_BUILDERS.COMPANY_BRAIN_EDIT(item.id)}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </Link>
            </PermissionGuard>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 p-2 text-slate-500 transition-colors hover:border-white/20 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-5">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300 font-sans">
            {item.body}
          </pre>
        </div>

        {/* Relationships */}
        {relationships.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              Connected Domains
            </p>
            <div className="space-y-2">
              {relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
                >
                  <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200">
                      {rel.relatedEntityLabel}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">
                      {rel.relatedDomain.replace("_", " ")} ·{" "}
                      {rel.relationshipType.replace("_", " ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-500">
          <span>Owner: {item.owner}</span>
          <span>
            Updated {formatRelativeDate(item.updatedAt)}
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ------------------------------------------------------------------
// Metric Card
// ------------------------------------------------------------------

function MetricCard({
  icon: Icon,
  value,
  label,
  variant,
}: {
  icon: typeof CheckCircle2;
  value: string;
  label: string;
  variant: "success" | "info" | "active" | "warning" | "neutral";
}) {
  const iconColor =
    variant === "success"
      ? "text-emerald-300"
      : variant === "info"
        ? "text-blue-300"
        : variant === "active"
          ? "text-violet-300"
          : variant === "warning"
            ? "text-amber-300"
            : "text-slate-400";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
