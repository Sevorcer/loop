"use client";

import { Command, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { CopilotSearchItem, CopilotSearchResponse } from "@/features/copilot";

import { isCloseShortcut, isOpenShortcut } from "../utils/shortcut";

const RECENT_STORAGE_KEY = "loop.command-bar.recent";

type RecentEntry = Pick<CopilotSearchItem, "id" | "title" | "subtitle" | "domain" | "sourceLabel" | "href">;

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

function normalizeRecent(item: CopilotSearchItem): RecentEntry {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    domain: item.domain,
    sourceLabel: item.sourceLabel,
    href: item.href,
  };
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
  const [recent, setRecent] = useState<RecentEntry[]>([]);

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
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as RecentEntry[];
      if (Array.isArray(parsed)) {
        setRecent(parsed.slice(0, 5));
      }
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setGroups([]);
      setMode("structured");
      setExpandedResponse(undefined);
      setLoading(false);
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
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open, pathname, query]);

  const hasQuery = query.trim().length > 0;
  const firstItem = groups[0]?.items[0];

  const onSelect = (item: RecentEntry | CopilotSearchItem) => {
    const normalized = "domain" in item ? item : item;
    setRecent((previous) => {
      const deduped = [normalized, ...previous.filter((entry) => entry.id !== normalized.id)].slice(0, 5);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(deduped));
      return deduped;
    });

    setQuery("");
    onOpenChange(false);
    router.push(normalized.href);
  };

  const desktopTooltipLabel = useMemo(() => "Ask Copilot", []);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
        <div className="group relative">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => onOpenChange(true)}
            aria-label="Open command bar"
            className="h-10 w-10 rounded-full border border-white/15 bg-slate-900/90 text-slate-200 shadow-xl hover:bg-slate-800"
          >
            <Command className="h-4 w-4" />
          </Button>
          <span className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {desktopTooltipLabel}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        onClick={() => onOpenChange(true)}
        aria-label="Open command bar"
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full border border-white/15 bg-slate-900/95 text-slate-100 shadow-xl sm:hidden"
      >
        <Search className="h-5 w-5" />
      </Button>

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
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && firstItem) {
                    event.preventDefault();
                    onSelect(firstItem);
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
                  {loading ? <p className="text-sm text-slate-500">Searching…</p> : null}

                  {!loading && groups.length === 0 ? (
                    <p className="text-sm text-slate-500">No results found.</p>
                  ) : null}

                  {groups.map((group) => (
                    <section key={group.domain} className="space-y-2">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</h2>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                            onClick={() => onSelect(item)}
                          >
                            <span className="space-y-1">
                              <span className="block text-sm font-medium text-white">{item.title}</span>
                              <span className="block text-xs text-slate-400">{item.subtitle ?? item.sourceLabel}</span>
                            </span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                              {item.sourceLabel}
                            </span>
                          </button>
                        ))}
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
