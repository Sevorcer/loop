import type { AppRole } from "@/services/authorization";

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

export type UserAccountStatus = "active" | "inactive";

export interface OrgUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  status: UserAccountStatus;
  /** ISO timestamp of last sign-in; null when the user has never signed in */
  lastSignInAt: string | null;
  createdAt: string;
}

export interface InviteUserPayload {
  email: string;
  fullName: string;
  role: AppRole;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: AppRole;
}

// ---------------------------------------------------------------------------
// Appearance Preferences
// ---------------------------------------------------------------------------

export type AccentColor = "blue" | "purple" | "green" | "orange" | "red" | "cyan";
export type ColorMode = "dark" | "light";
export type SpacingMode = "comfortable" | "compact";
export type DashboardLayout = "default" | "condensed" | "wide";
export type CommandCenterLayout = "default" | "focused";

export interface AppearancePreferences {
  accentColor: AccentColor;
  colorMode: ColorMode;
  spacing: SpacingMode;
  defaultLandingPage: string;
  sidebarPinnedDefault: boolean;
  sidebarNavOverride: string[];
  dashboardLayout: DashboardLayout;
  commandCenterLayout: CommandCenterLayout;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  accentColor: "blue",
  colorMode: "dark",
  spacing: "comfortable",
  defaultLandingPage: "/dashboard",
  sidebarPinnedDefault: false,
  sidebarNavOverride: [],
  dashboardLayout: "default",
  commandCenterLayout: "default",
};
