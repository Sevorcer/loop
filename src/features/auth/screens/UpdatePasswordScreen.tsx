"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";

import {
  createCorrelationId,
  incrementAuthMetric,
  logAuthEvent,
} from "@/lib/observability/auth";
import { ROUTES } from "@/lib/routes";
import {
  isAuthClientConfigured,
  establishPasswordLinkSession,
  getRecoverySession,
  updateUserPassword,
} from "@/services/authClient";
import {
  classifyPasswordLink,
  parsePasswordLink,
  type PasswordLinkKind,
} from "@/features/auth/lib/passwordLink";
import { Button } from "@/components/ui/button";

type ScreenState = "checking" | "ready" | "invalid" | "invite_expired" | "done";

function rememberPasswordLink(kind: PasswordLinkKind): void {
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of [
    "access_token",
    "refresh_token",
    "token_hash",
    "code",
    "error",
    "error_code",
    "error_description",
    "type",
  ]) {
    url.searchParams.delete(key);
  }
  url.searchParams.set("flow", kind);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

const MIN_PASSWORD_LENGTH = 8;

export function UpdatePasswordScreen() {
  const router = useRouter();

  const [screenState, setScreenState] = useState<ScreenState>("checking");
  const [intent, setIntent] = useState<PasswordLinkKind | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite links arrive as type=invite in the URL hash. Recovery links arrive
  // as type=recovery. The PKCE browser client does not consume that hash, so
  // the session is applied explicitly before the form is shown.
  useEffect(() => {
    // queueMicrotask defers the setState calls out of the synchronous effect
    // body, satisfying the react-hooks/set-state-in-effect lint rule.
    queueMicrotask(() => {
      void (async () => {
        const requestId = createCorrelationId();

        if (!isAuthClientConfigured()) {
          setError("Authentication is not configured. Please contact support.");
          setScreenState("invalid");
          return;
        }

        const link = parsePasswordLink(window.location.hash, window.location.search);
        const decision = classifyPasswordLink(link);

        const showFailure = (kind: PasswordLinkKind | null, errorCode: string) => {
          logAuthEvent({
            event: "password_update_invalid_link",
            outcome: "failure",
            route: ROUTES.UPDATE_PASSWORD,
            statusCode: 400,
            requestId,
            correlationId: requestId,
            errorCode,
          });
          setIntent(kind);
          setScreenState(kind === "invite" ? "invite_expired" : "invalid");
        };

        if (decision.action === "invalid") {
          showFailure(null, "NOT_A_PASSWORD_LINK");
          return;
        }

        if (decision.action === "establish") {
          const opened = await establishPasswordLinkSession(link);
          const session = opened ? true : Boolean(await getRecoverySession());
          if (!session) {
            showFailure(
              decision.kind,
              decision.kind === "invite" ? "INVITE_SESSION_FAILED" : "NO_RECOVERY_SESSION",
            );
            return;
          }
          if (opened) rememberPasswordLink(decision.kind);
          setIntent(decision.kind);
          setScreenState("ready");
          return;
        }

        const existing = await getRecoverySession();
        if (existing) {
          setIntent(decision.kind);
          setScreenState("ready");
          return;
        }

        showFailure(
          decision.kind,
          decision.kind === "invite" ? "INVITE_EXPIRED" : "RECOVERY_EXPIRED",
        );
      })();
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const requestId = createCorrelationId();

      if (!isAuthClientConfigured()) {
        setError("Authentication is not configured. Please contact support.");
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      setIsLoading(true);
      setError(null);

      const result = await updateUserPassword(password);

      if (!result.ok) {
        logAuthEvent({
          event: "password_update_failure",
          outcome: "failure",
          route: ROUTES.UPDATE_PASSWORD,
          statusCode: 400,
          requestId,
          correlationId: requestId,
          errorCode: result.error.code,
          details: { message: result.error.message },
        });
        incrementAuthMetric("auth_password_update_failure_total", {
          route: ROUTES.UPDATE_PASSWORD,
        });
        setError(result.error.message);
        setIsLoading(false);
        return;
      }

      logAuthEvent({
        event: "password_update_success",
        outcome: "success",
        route: ROUTES.UPDATE_PASSWORD,
        statusCode: 200,
        requestId,
        correlationId: requestId,
      });
      incrementAuthMetric("auth_password_update_success_total", {
        route: ROUTES.UPDATE_PASSWORD,
      });

      setScreenState("done");
      router.push(ROUTES.DASHBOARD);
      router.refresh();
    },
    [password, confirmPassword, router]
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
          {screenState === "checking" ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--foreground-muted)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Verifying your link…
            </div>
          ) : screenState === "invalid" || screenState === "invite_expired" ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                {screenState === "invite_expired" ? "Invite expired" : "Reset link invalid"}
              </h2>
              <p className="mb-6 text-sm text-[var(--foreground-muted)]">
                {screenState === "invite_expired"
                  ? "This invite link is invalid or has expired. Ask your office to send a new one, then open the new email."
                  : "This password reset link is invalid or has expired. Request a new one from your administrator and try again."}
              </p>
              {error ? (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
              <Button
                type="button"
                className="w-full"
                onClick={() => router.push(ROUTES.SIGN_IN)}
              >
                Back to sign in
              </Button>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-white">
                {intent === "invite" ? "Create your password" : "Set a new password"}
              </h2>
              <p className="mb-6 text-sm text-[var(--foreground-muted)]">
                {intent === "invite"
                  ? "Choose a password to finish setting up your account. Your office already assigned your role."
                  : "Choose a new password for your account."}
              </p>

              {screenState === "done" ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm text-green-400">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Password updated. Taking you to your dashboard…
                  </span>
                </div>
              ) : (
                <>
                  {error ? (
                    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="new-password"
                        className="block text-sm font-medium text-[var(--foreground-muted)]"
                      >
                        New password
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        placeholder="••••••••"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="confirm-password"
                        className="block text-sm font-medium text-[var(--foreground-muted)]"
                      >
                        Confirm new password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white placeholder-[var(--foreground-muted)] outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                        placeholder="••••••••"
                      />
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          {intent === "invite" ? "Saving…" : "Updating…"}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <KeyRound size={15} />
                          {intent === "invite" ? "Save password" : "Update password"}
                        </span>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--foreground-muted)]">
          LOOP — The Operating System for Field Operations
        </p>
      </div>
    </div>
  );
}
