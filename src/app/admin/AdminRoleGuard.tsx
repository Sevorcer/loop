"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useCurrentRole } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import { canAccessAdminArea } from "@/services/authorization";

/**
 * Browser half of the /admin role gate. The server layout already redirected
 * anyone who is not an owner or manager. This keeps the shell from painting
 * while the role is still loading, and sends a technician away if the role
 * changes after the page is open.
 */
export function AdminRoleGuard({ children }: { children: React.ReactNode }) {
  const { role } = useCurrentRole();
  const router = useRouter();
  const allowed = canAccessAdminArea(role);

  useEffect(() => {
    if (role && !allowed) {
      router.replace(ROUTES.JOBS);
    }
  }, [allowed, role, router]);

  if (allowed) {
    return <>{children}</>;
  }

  if (role) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
    </div>
  );
}
