"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { formatClock } from "../utils/liveOpsUtils";
import { shouldRefresh } from "../utils/liveRefresh";

export function LiveAutoRefresh({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paused, setPaused] = useState(false);
  const lastRefresh = useRef(0);

  const refresh = useCallback(() => {
    lastRefresh.current = Date.now();
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    lastRefresh.current = new Date(generatedAt).getTime() || Date.now();
  }, [generatedAt]);

  useEffect(() => {
    const tick = () => {
      if (shouldRefresh(document.visibilityState, lastRefresh.current, Date.now())) refresh();
    };
    const onVisibility = () => {
      setPaused(document.visibilityState !== "visible");
      tick(); // catch up right away when the tab comes back
    };
    const timer = window.setInterval(tick, 5_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span suppressHydrationWarning>
        {paused ? "Paused while hidden · " : ""}Updated {formatClock(generatedAt)}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-60"
      >
        <RefreshCw className={isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {isPending ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
