/**
 * Password-recovery link parsing.
 *
 * Supabase password-recovery emails link to the configured Site URL with the
 * session encoded in the URL fragment, e.g.
 *   https://app.example.com/update-password#access_token=...&type=recovery
 *
 * The Supabase browser client consumes the fragment itself
 * (detectSessionInUrl); this module only answers "did the user arrive here
 * via a recovery link?" so the UI can decide between the set-password form
 * and the invalid-link state.
 */

export interface RecoveryLinkInfo {
  /** True when the fragment marks this navigation as a recovery flow. */
  isRecovery: boolean;
  /** True when the fragment carries an access token the client can consume. */
  hasAccessToken: boolean;
}

export function parseRecoveryHash(hash: string): RecoveryLinkInfo {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(fragment);
  return {
    isRecovery: params.get("type") === "recovery",
    hasAccessToken: params.get("access_token") !== null,
  };
}
