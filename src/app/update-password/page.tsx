import { UpdatePasswordScreen } from "@/features/auth";

/**
 * Set-new-password page — public route, no auth required.
 *
 * Landed on from Supabase password-recovery emails, which link here with the
 * recovery session in the URL fragment (type=recovery). The screen consumes
 * the fragment and lets the user choose a new password.
 */
export default function UpdatePasswordPage() {
  return <UpdatePasswordScreen />;
}
