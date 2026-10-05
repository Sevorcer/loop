"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentRole } from "@/features/auth";

export function AdminRoleGuard({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentRole();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== "owner") {
      router.replace("/jobs");
    }
  }, [role, router]);

  // Fail closed: the admin UI renders only when the role is exactly "owner".
  if (role === "owner") {
    return <>{children}</>;
  }

  // Known non-owner role — the redirect above is in flight, render nothing.
  if (role) {
    return null;
  }

  // Role is loading or unknown — never render the admin UI (or redirect)
  // until the role is positively known.
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
    </div>
  );
}
