"use client";

import { User } from "lucide-react";
import { useAuth } from "../state/AuthProvider";

/**
 * Displays the currently authenticated user's email address in the Sidebar.
 * Must be rendered inside `AuthProvider`.
 */
export function UserDisplay() {
  const { user } = useAuth();

  if (!user) return null;

  const displayName = user.user_metadata?.full_name ?? user.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30">
        {initials ? (
          <span className="text-[10px] font-semibold">{initials}</span>
        ) : (
          <User size={13} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-300">{displayName}</p>
        {user.user_metadata?.full_name ? (
          <p className="truncate text-[10px] text-slate-500">{user.email}</p>
        ) : null}
      </div>
    </div>
  );
}
