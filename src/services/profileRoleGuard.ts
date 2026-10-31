import { isAppRole } from "@/features/auth/utils/appRole";

/**
 * Decides whether a settings update may change someone's role.
 * The database trigger is the real lock. This check runs first so the
 * settings page can say why a change was refused.
 */
export function canGrantOwnerRole(callerRole: string | null | undefined): boolean {
  return callerRole === "owner";
}

export function refusalForOwnerInvite(input: {
  callerRole: string | null;
  appRole: string;
}): string | null {
  if (!isAppRole(input.appRole)) {
    return "That role is invalid.";
  }

  if (input.appRole === "owner" && !canGrantOwnerRole(input.callerRole)) {
    return "Only an owner can grant the owner role.";
  }

  return null;
}

export function refusalForProfileRoleChange(input: {
  callerId: string;
  targetId: string;
  callerRole: string | null;
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

  const touchesOwner = input.nextRole === "owner" || input.currentRole === "owner";
  if (touchesOwner && !canGrantOwnerRole(input.callerRole)) {
    return "Only an owner can grant or remove the owner role.";
  }

  return null;
}
