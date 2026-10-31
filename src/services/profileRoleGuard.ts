import { isAppRole } from "@/features/auth/utils/appRole";

/**
 * Decides whether a settings update may change someone's role.
 * The database trigger is the real lock. This check runs first so the
 * settings page can say why a change was refused.
 */
export function refusalForProfileRoleChange(input: {
  callerId: string;
  targetId: string;
  sameCompany: boolean;
  currentRole: string | null;
  nextRole: string | undefined;
}): string | null {
  if (!input.sameCompany) {
    return "That person is not in your company.";
  }

  if (input.nextRole === undefined || input.nextRole === input.currentRole) {
    return null;
  }

  if (!isAppRole(input.nextRole)) {
    return "That role is invalid.";
  }

  if (input.callerId === input.targetId) {
    return "Changing your own role is denied.";
  }

  return null;
}
