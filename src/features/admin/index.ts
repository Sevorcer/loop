// Admin feature public API — Sprint 30 IA refactor

// Shell
export { AdminShell } from "./components/AdminShell";
export { AdminSidebar } from "./components/AdminSidebar";

// Screens
export { AdminLandingScreen } from "./screens/AdminLandingScreen";
export { OrganizationsScreen } from "./screens/OrganizationsScreen";
// Legacy screens kept for any external references — operational entities have
// been moved to their own /admin redirect pages (backward compat only).
export { CustomersAdminScreen } from "./screens/CustomersAdminScreen";
export { PropertiesAdminScreen } from "./screens/PropertiesAdminScreen";
export { JobsAdminScreen } from "./screens/JobsAdminScreen";

// Form primitives
export {
  AdminFieldWrapper,
  AdminFieldError,
  AdminFormError,
  AdminFormActions,
} from "./components/form";
