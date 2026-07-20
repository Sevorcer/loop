<<<<<<< HEAD
/**
 * Public API for the LOOP auth feature.
 *
 * Provides role context, permission hooks, and UI gating primitives
 * used throughout the application shell.
 */

export { RoleProvider, useCurrentRole } from "./RoleContext";
export { usePermission } from "./usePermission";
export { PermissionGate } from "./PermissionGate";
=======
// Auth feature public API

export { AuthProvider, useAuth } from "./state/AuthProvider";
export { SignOutButton } from "./components/SignOutButton";
export { UserDisplay } from "./components/UserDisplay";
export { SignInScreen } from "./screens/SignInScreen";
>>>>>>> origin/main
