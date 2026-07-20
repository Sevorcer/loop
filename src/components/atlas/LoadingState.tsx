import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

/**
 * LoadingState — Atlas-tier loading indicator.
 *
 * Used for full-section and route-level loading states where content is
 * pending resolution (e.g. auth session, data hydration).
 */
export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-label={message}
      className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400"
    >
      <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
