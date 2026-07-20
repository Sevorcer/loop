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
