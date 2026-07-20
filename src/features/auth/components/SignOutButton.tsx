"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "../state/AuthProvider";

interface SignOutButtonProps {
  /** Optional className for the outer button element. */
  className?: string;
}

/**
 * Sign-out button for use in the Sidebar and other navigation chrome.
 *
 * Reads `signOut` from AuthContext — must be rendered inside `AuthProvider`.
 */
export function SignOutButton({ className }: SignOutButtonProps) {
  const { signOut, isLoading } = useAuth();

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isLoading}
      aria-label="Sign out"
      className={[
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:pointer-events-none disabled:opacity-50",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 group-hover:text-slate-200">
        <LogOut size={15} />
      </div>
      <span className="truncate">{isLoading ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
