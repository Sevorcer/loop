// Settings feature public API — Sprint 7 Settings Enhancements

// Shell
export { SettingsShell } from "./components/SettingsShell";
export { SettingsSidebar } from "./components/SettingsSidebar";

// Screens
export { UsersScreen } from "./screens/UsersScreen";
export { AppearanceScreen } from "./screens/AppearanceScreen";
export { RolesScreen } from "./screens/RolesScreen";

// Components
export { InviteUserDialog } from "./components/InviteUserDialog";
export { EditUserDialog } from "./components/EditUserDialog";
export { UserStatusBadge } from "./components/UserStatusBadge";

// Hooks
export { useAppearancePreferences } from "./hooks/useAppearancePreferences";

// Config
export { SETTINGS_NAV_ITEMS, SETTINGS_AREA_LABEL } from "./config/settingsNavItems";
export type { SettingsNavItem } from "./config/settingsNavItems";

// Types
export type {
  OrgUser,
  InviteUserPayload,
  UpdateUserPayload,
  AppearancePreferences,
  AccentColor,
  ColorMode,
  SpacingMode,
  DashboardLayout,
  CommandCenterLayout,
  UserAccountStatus,
} from "./types";
export { DEFAULT_APPEARANCE } from "./types";

