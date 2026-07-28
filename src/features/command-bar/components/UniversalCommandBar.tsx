"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { CopilotSearchItem, CopilotSearchResponse } from "@/features/copilot";

import { isCloseShortcut, isOpenShortcut } from "../utils/shortcut";

const RECENT_STORAGE_KEY = "loop.command-bar.recent";
const MAX_RECENT_ENTRIES = 5;
const SEARCH_DEBOUNCE_MS = 180;

type RecentEntry = Pick<CopilotSearchItem, "id" | "title" | "subtitle" | "domain" | "sourceLabel" | "href">;

type SearchFilterId = "all" | "customers" | "properties" | "jobs" | "installed_systems" | "company_brain";

const SEARCH_FILTERS: Array<{ id: SearchFilterId; label: string; domain?: CopilotSearchItem["domain"] }> = [
  { id: "all", label: "All" },
  { id: "customers", label: "Customers", domain: "customers" },
  { id: "properties", label: "Properties", domain: "properties" },
  { id: "jobs", label: "Jobs", domain: "jobs" },
  { id: "installed_systems", label: "Installed Systems", domain: "installed_systems" },
  { id: "company_brain", label: "Knowledge", domain: "company_brain" },
];

const SUGGESTED: RecentEntry[] = [
  {
    id: "suggested-dispatch",
    title: "Go to Dispatch",
    subtitle: "Navigation",
    domain: "navigation",
    sourceLabel: "Navigation",
    href: ROUTES.DISPATCH,
  },
  {
    id: "suggested-jobs",
    title: "Open Jobs",
    subtitle: "View active work",
    domain: "navigation",
    sourceLabel: "Navigation",
    href: ROUTES.JOBS,
  },
  {
    id: "suggested-photos",
    title: "Find site photos",
    subtitle: "Search photos across domains",
    domain: "photos",
    sourceLabel: "Copilot",
    href: ROUTES.PROPERTIES,
  },
];

interface UniversalCommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecentSection({
  entries,
  onSelect,
}: {
  entries: RecentEntry[];
  onSelect: (entry: RecentEntry) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No recent command results yet.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
          onClick={() => onSelect(entry)}
        >
          <span className="text-sm font-medium text-white">{entry.title}</span>
          <span className="text-xs text-slate-400">{entry.subtitle ?? entry.sourceLabel}</span>
        </button>
      ))}
    </div>
  );
}

export function UniversalCommandBar({ open, onOpenChange }: UniversalCommandBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<CopilotSearchResponse["groups"]>([]);
  const [mode, setMode] = useState<CopilotSearchResponse["mode"]>("structured");
  const [expandedResponse, setExpandedResponse] = useState<string | undefined>();
  const [activeFilter, setActiveFilter] = useState<SearchFilterId>("all");
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [recent, setRecent] = useState<RecentEntry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as RecentEntry[];
      return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_ENTRIES) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isOpenShortcut(event)) {
        event.preventDefault();
        onOpenChange(true);
        return;
      }

      if (!open) {
        return;
      }

      if (isCloseShortcut(event)) {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch("/api/copilot/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            context: {
              pathname,
            },
          }),
        });

        if (!response.ok) {
          setGroups([]);
          setMode("structured");
          setExpandedResponse(undefined);
          return;
        }

        const payload = (await response.json()) as CopilotSearchResponse;
        setGroups(payload.groups);
        setMode(payload.mode);
        setExpandedResponse(payload.response);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [open, pathname, query]);

  const hasQuery = query.trim().length > 0;
  const filteredGroups = groups
    .map((group) => {
      if (activeFilter === "all") {
        return group;
      }

      const selected = SEARCH_FILTERS.find((filter) => filter.id === activeFilter);
      if (!selected?.domain || selected.domain !== group.domain) {
        return { ...group, items: [] };
      }

      return group;
    })
    .filter((group) => group.items.length > 0);
  const filteredItems = filteredGroups.flatMap((group) => group.items);
  const firstItem = filteredItems[0];

  const onSelect = (item: RecentEntry | CopilotSearchItem) => {
    const normalized = item;
    setRecent((previous) => {
      const deduped = [normalized, ...previous.filter((entry) => entry.id !== normalized.id)].slice(
        0,
        MAX_RECENT_ENTRIES
      );
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(deduped));
      return deduped;
    });

    setQuery("");
    onOpenChange(false);
    router.push(normalized.href);
  };

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close command bar"
            onClick={() => onOpenChange(false)}
          />

          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  setActiveResultIndex(0);
                  if (!nextQuery.trim()) {
                    setActiveFilter("all");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onOpenChange(false);
                    return;
                  }

                  if (!filteredItems.length) {
                    return;
                  }

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveResultIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveResultIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const selectedItem = filteredItems[activeResultIndex] ?? firstItem;
                    if (selectedItem) {
                      onSelect(selectedItem);
                    }
                  }
                }}
                placeholder="Ask Copilot… What are you looking for today?"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close command bar"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4">
              {!hasQuery ? (
                <div className="space-y-6">
                  <p className="text-sm text-slate-400">Ask Copilot… What are you looking for today?</p>

                  <section className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent</h2>
                    <RecentSection entries={recent} onSelect={onSelect} />
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Suggested</h2>
                    <RecentSection entries={SUGGESTED} onSelect={onSelect} />
                  </section>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {SEARCH_FILTERS.map((filter) => {
                      const count = filter.domain
                        ? groups.find((group) => group.domain === filter.domain)?.items.length ?? 0
                        : groups.reduce((total, group) => total + group.items.length, 0);
                      const selected = activeFilter === filter.id;
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          className={[
                            "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            selected
                              ? "border-white/20 bg-white/15 text-white"
                              : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08]",
                          ].join(" ")}
                          onClick={() => {
                            setActiveFilter(filter.id);
                            setActiveResultIndex(0);
                          }}
                        >
                          {filter.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {loading ? <p className="text-sm text-slate-500">Searching…</p> : null}

                  {!loading && filteredGroups.length === 0 ? (
                    <p className="text-sm text-slate-500">No results found.</p>
                  ) : null}

                  {filteredGroups.map((group) => (
                    <section key={group.domain} className="space-y-2">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</h2>
                      <div className="space-y-2">
                        {group.items.map((item) => {
                          const itemIndex = filteredItems.findIndex((entry) => entry.id === item.id);
                          const isActive = itemIndex === activeResultIndex;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={[
                                "flex w-full items-start justify-between gap-4 rounded-xl border px-3 py-2 text-left transition-colors",
                                isActive
                                  ? "border-white/25 bg-white/[0.1]"
                                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]",
                              ].join(" ")}
                              onClick={() => onSelect(item)}
                            >
                              <span className="space-y-1">
                                <span className="block text-sm font-medium text-white">{item.title}</span>
                                <span className="block text-xs text-slate-400">{item.subtitle ?? item.sourceLabel}</span>
                                <span className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                  {item.metadata?.status ? (
                                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                                      {item.metadata?.status}
                                    </span>
                                  ) : null}
                                  {item.metadata?.timestamp ? (
                                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                                      {item.metadata?.timestamp}
                                    </span>
                                  ) : null}
                                  {(item.metadata?.badges ?? []).slice(0, 2).map((badge) => (
                                    <span key={`${item.id}-${badge}`} className="rounded-full border border-white/10 px-2 py-0.5">
                                      {badge}
                                    </span>
                                  ))}
                                </span>
                              </span>
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                {item.sourceLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {mode === "expanded" && expandedResponse ? (
                    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Copilot</h2>
                      <p className="mt-2 text-sm text-slate-300">{expandedResponse}</p>
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
