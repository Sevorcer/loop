import { UpdatePasswordScreen } from "@/features/auth";

/**
 * Set-password page — public route, no auth required.
 *
 * Invite emails land here with type=invite (and flow=invite). Password-reset
 * emails for people who already have accounts land here with type=recovery.
 * The screen applies the session from the URL and lets them choose a password.
 * It does not ask for a role.
 */
export default function UpdatePasswordPage() {
  return <UpdatePasswordScreen />;
}
