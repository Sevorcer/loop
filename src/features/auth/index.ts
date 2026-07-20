// Auth feature public API

// Session-based auth (Supabase)
export { AuthProvider, useAuth } from "./state/AuthProvider";
export { SignOutButton } from "./components/SignOutButton";
export { UserDisplay } from "./components/UserDisplay";
export { SignInScreen } from "./screens/SignInScreen";

// Role context, permission hooks, and UI gating primitives
export { RoleProvider, useCurrentRole } from "./RoleContext";
export { usePermission } from "./usePermission";
export { PermissionGate } from "./PermissionGate";

// Dev/mock session provider (kept for backward compatibility)
export { SessionProvider, useSession } from "./SessionProvider";

// Navigation permission utilities
export { getNavItemsForRole, NAV_ROUTE_ROLES } from "./utils/navPermissions";
export type { NavItem, NavGroup } from "./utils/navPermissions";
