/**
 * Account-setup and password-reset links.
 *
 * Office invites go out through Supabase `inviteUserByEmail`. That email is
 * not a PKCE link: after Supabase verifies it, the browser lands with the
 * session in the URL hash (`type=invite`). The app's browser client is the
 * SSR client, which only accepts PKCE (`?code=`), so it refuses that hash.
 * The setup page used to require `type=recovery` as well, and a fresh invite
 * was shown as an expired password reset.
 *
 * Recovery emails for people who already have accounts still use
 * `type=recovery` and the same hash shape. Both are accepted here. The
 * `flow=invite` query is added by our own redirect so an expired invite
 * (whose error hash does not include a type) is not described as a reset.
 */

import { ROUTES } from "@/lib/routes";

export type PasswordLinkKind = "invite" | "recovery";

export interface PasswordLink {
  kind: PasswordLinkKind | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  /** Token type to pass to verifyOtp. This follows the link, not the copy. */
  otpType: PasswordLinkKind | null;
  code: string | null;
  hasAuthError: boolean;
}

export type PasswordLinkDecision =
  | { action: "establish"; kind: PasswordLinkKind }
  | { action: "expired"; kind: PasswordLinkKind }
  | { action: "invalid" };

const INVITE_FLOW = "invite";

function paramsFrom(value: string): URLSearchParams {
  const trimmed = value.startsWith("#") || value.startsWith("?") ? value.slice(1) : value;
  return new URLSearchParams(trimmed);
}

function first(query: URLSearchParams, fragment: URLSearchParams, key: string): string | null {
  const value = fragment.get(key) ?? query.get(key);
  return value && value.length > 0 ? value : null;
}

export function accountSetupRedirect(origin: string): string {
  const url = new URL(ROUTES.UPDATE_PASSWORD, originBase(origin));
  url.searchParams.set("flow", INVITE_FLOW);
  return url.toString();
}

export function passwordRecoveryRedirect(origin: string): string {
  return new URL(ROUTES.UPDATE_PASSWORD, originBase(origin)).toString();
}

function originBase(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("A valid app origin is required to build an account link.");
  }
  return `${trimmed}/`;
}

export function parsePasswordLink(hash: string, search: string): PasswordLink {
  const query = paramsFrom(search);
  const fragment = paramsFrom(hash);
  const type = first(query, fragment, "type");
  const flow = query.get("flow");
  const markedInvite = flow === INVITE_FLOW;
  const markedRecovery = flow === "recovery";
  const kind = linkKind(type, markedInvite, markedRecovery);
  const otpType: PasswordLinkKind | null =
    type === "invite" || type === "recovery"
      ? type
      : markedInvite && kind === "invite"
        ? "invite"
        : null;

  return {
    kind,
    accessToken: first(query, fragment, "access_token"),
    refreshToken: first(query, fragment, "refresh_token"),
    tokenHash: first(query, fragment, "token_hash"),
    otpType,
    code: first(query, fragment, "code"),
    hasAuthError: Boolean(
      first(query, fragment, "error") ||
        first(query, fragment, "error_code") ||
        first(query, fragment, "error_description"),
    ),
  };
}

function linkKind(
  type: string | null,
  markedInvite: boolean,
  markedRecovery: boolean,
): PasswordLinkKind | null {
  if (type === "invite") return "invite";
  if (type === "recovery") return markedInvite ? "invite" : "recovery";
  // Expired links omit type. The flow marker is also what remains after the
  // hash tokens are removed, so a refresh can keep the right screen.
  // Signup and magic-link types are never account setup — public sign-up stays off.
  if (type !== null) return null;
  if (markedInvite) return "invite";
  if (markedRecovery) return "recovery";
  return null;
}

export function classifyPasswordLink(link: PasswordLink): PasswordLinkDecision {
  if (link.hasAuthError) {
    return link.kind ? { action: "expired", kind: link.kind } : { action: "invalid" };
  }

  const canEstablish = Boolean(
    (link.accessToken && link.refreshToken) ||
      (link.tokenHash && link.otpType) ||
      link.code,
  );

  if (link.kind && canEstablish) {
    return { action: "establish", kind: link.kind };
  }

  if (link.kind) {
    return { action: "expired", kind: link.kind };
  }

  return { action: "invalid" };
}

/**
 * Send a person who landed somewhere else (site root, sign-in, a shell page)
 * to the password page without dropping the invite or recovery credentials.
 * Already on that page returns null so the handoff cannot loop.
 */
export function passwordLinkHandoffHref(
  pathname: string,
  hash: string,
  search: string,
): string | null {
  if (
    pathname === ROUTES.UPDATE_PASSWORD ||
    pathname.startsWith(`${ROUTES.UPDATE_PASSWORD}/`)
  ) {
    return null;
  }

  const link = parsePasswordLink(hash, search);
  if (!link.kind) return null;

  const incoming = paramsFrom(search);
  const nextQuery = new URLSearchParams();
  if (link.kind === "invite") nextQuery.set("flow", INVITE_FLOW);
  for (const key of [
    "token_hash",
    "type",
    "code",
    "error",
    "error_code",
    "error_description",
  ] as const) {
    const value = incoming.get(key);
    if (value) nextQuery.set(key, value);
  }

  let fragment = hash ? (hash.startsWith("#") ? hash : `#${hash}`) : "";
  const queryAccess = incoming.get("access_token");
  const queryRefresh = incoming.get("refresh_token");
  if ((queryAccess || queryRefresh) && !fragment.includes("access_token=")) {
    const fragmentParams = paramsFrom(fragment);
    if (queryAccess) fragmentParams.set("access_token", queryAccess);
    if (queryRefresh) fragmentParams.set("refresh_token", queryRefresh);
    fragment = `#${fragmentParams.toString()}`;
  }

  const query = nextQuery.toString();
  return `${ROUTES.UPDATE_PASSWORD}${query ? `?${query}` : ""}${fragment}`;
}
