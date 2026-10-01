"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, AlertCircle } from "lucide-react";

import {
  createCorrelationId,
  incrementAuthMetric,
  logAuthEvent,
} from "@/lib/observability/auth";
import { ROUTES } from "@/lib/routes";
import { isAuthClientConfigured, signInWithPassword } from "@/services/authClient"; import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function getEmailDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1 || atIndex === trimmed.length - 1) return "unknown";
  return trimmed.slice(atIndex + 1);
}

export function SignInScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const requestId = createCorrelationId();
      const normalizedEmail = email.trim();
      const emailDomain = getEmailDomain(normalizedEmail);
      if (!isAuthClientConfigured()) {
        logAuthEvent({
          event: "sign_in_failure",
          outcome: "failure",
          route: ROUTES.SIGN_IN,
          statusCode: 503,
          requestId,
          correlationId: requestId,
          errorCode: "SUPABASE_NOT_CONFIGURED",
          details: { emailDomain },
        });
        incrementAuthMetric("auth_sign_in_failure_total", { route: ROUTES.SIGN_IN });
        setError("Authentication is not configured. Please contact support.");
        return;
      }
      setIsLoading(true);
      setError(null);

      const result = await signInWithPassword(normalizedEmail, password);

      if (!result.ok) {
        logAuthEvent({
          event: "sign_in_failure",
          outcome: "failure",
          route: ROUTES.SIGN_IN,
          statusCode: 401,
          requestId,
          correlationId: requestId,
          errorCode: result.error.code,
          details: {
            message: result.error.message,
            emailDomain,
          },
        });
        incrementAuthMetric("auth_sign_in_failure_total", { route: ROUTES.SIGN_IN });
        setError(result.error.message);
        setIsLoading(false);
        return;
      }

      logAuthEvent({
        event: "sign_in_success",
        outcome: "success",
        route: ROUTES.SIGN_IN,
        statusCode: 200,
        requestId,
        correlationId: requestId,
        details: { emailDomain },
      });

      // Redirect to the intended destination (set by middleware) or dashboard.
      const requestedNext = searchParams.get("next");       let next = requestedNext ?? ROUTES.DASHBOARD;       if (!requestedNext) {         try {           const supabase = getSupabaseBrowserClient();           const { data: authData } = await supabase.auth.getUser();           const userId = authData.user?.id;           if (userId) {             const { data: profileRow } = await supabase               .from("user_profiles")               .select("app_role")               .eq("id", userId)               .maybeSingle();             if ((profileRow as { app_role?: string | null } | null)?.app_role === "tech") {               next = ROUTES.JOBS;             }           }         } catch {           // Fall through to the default destination on any lookup failure.         }       }
      router.push(next);
      router.refresh();
    },
    [email, password, router, searchParams]
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute right-[-140px] top-[120px] h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">LOOP</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Field Operations Platform
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
          <h2 className="mb-1 text-lg font-semibold text-white">Sign in</h2>
          <p className="mb-6 text-sm text-[var(--foreground-muted)]">
            Enter your credentials to access the platform.
          </p>

          {error ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--foreground-muted)]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--foreground-muted)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={15} />
                  Sign in
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--foreground-muted)]">
          LOOP — The Operating System for Field Operations
        </p>
      </div>
    </div>
  );
}
