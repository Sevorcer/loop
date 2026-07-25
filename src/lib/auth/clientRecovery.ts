import { ROUTES } from "@/lib/routes";
import type { UnauthorizedReason } from "@/lib/api-auth";

let recoveryInFlight = false;

function buildSignInHref(location: Location) {
  const signInUrl = new URL(ROUTES.SIGN_IN, location.origin);
  const next = `${location.pathname}${location.search}${location.hash}`;

  if (next && next !== ROUTES.SIGN_IN) {
    signInUrl.searchParams.set("next", next);
  }

  return signInUrl.toString();
}

export function beginClientAuthRecovery(reason: UnauthorizedReason) {
  if (typeof window === "undefined") return;

  if (window.location.pathname.startsWith(ROUTES.SIGN_IN)) {
    recoveryInFlight = false;
    return;
  }

  window.dispatchEvent(
    new CustomEvent("loop:auth-recovery", {
      detail: {
        reason,
        next: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      },
    }),
  );

  if (recoveryInFlight) return;

  recoveryInFlight = true;
  window.location.replace(buildSignInHref(window.location));
}

export function resetClientAuthRecoveryForTests() {
  recoveryInFlight = false;
}
