import type { UnauthorizedReason } from "@/lib/auth/errorContract";
import { ROUTES } from "@/lib/routes";

// Single-flight guard: concurrent 401s may emit more than one event, but only
// the first call should trigger navigation so clients do not loop or thrash history.
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
  try {
    window.location.replace(buildSignInHref(window.location));
  } catch (error) {
    recoveryInFlight = false;
    throw error;
  }
}

export function resetClientAuthRecoveryForTests() {
  recoveryInFlight = false;
}
