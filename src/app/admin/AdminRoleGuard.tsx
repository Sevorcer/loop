"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentRole } from "@/features/auth";
export function AdminRoleGuard({ children }: { children: React.ReactNode }) {
const { role } = useCurrentRole();
const router = useRouter();
useEffect(() => { if (role && role !== "owner") { router.replace("/jobs"); } }, [role, router]);
if (role && role !== "owner") { return null; }
return <>{children}</>;
}
