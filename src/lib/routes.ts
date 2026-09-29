export const ROUTES = {
  HOME: "/",
  SIGN_IN: "/sign-in",
  UPDATE_PASSWORD: "/update-password",
  DASHBOARD: "/dashboard",
  OPERATIONS: "/operations",
  COMMAND_CENTER: "/command-center",
  PROPERTIES: "/properties",
  JOBS: "/jobs",
  CONTRACTORS: "/contractors",
  CUSTOMERS: "/customers",
  INSTALLED_SYSTEMS: "/installed-systems",
  VEHICLE_ALERTS: "/vehicle-alerts",
  DAILY_PLANS: "/daily-plans",
  CALENDAR: "/calendar",
  LIVE_OPERATIONS: "/live-operations",
  INVENTORY: "/inventory",
  DISPATCH: "/dispatch",
  COMPANY_BRAIN: "/company-brain",
  REPORTING: "/reporting",
  SETTINGS: "/settings",
  SETTINGS_USERS: "/settings/users",
  SETTINGS_APPEARANCE: "/settings/appearance",
  SETTINGS_ROLES: "/settings/roles",
  SETTINGS_FEEDBACK: "/settings/feedback",
  OPS_FEEDBACK: "/ops/feedback",
} as const;

export const ROUTE_BUILDERS = {
  JOB_NEW: (context?: { customerId?: string; propertyId?: string }) => {
    const params = new URLSearchParams();
    if (context?.customerId) params.set("customerId", context.customerId);
    if (context?.propertyId) params.set("propertyId", context.propertyId);
    const query = params.toString();
    return query ? `${ROUTES.JOBS}/new?${query}` : `${ROUTES.JOBS}/new`;
  },
  JOB_DETAIL: (jobId: string) => `${ROUTES.JOBS}/${jobId}`,
  JOB_EDIT: (jobId: string) => `${ROUTES.JOBS}/${jobId}/edit`,
  PROPERTY_DETAIL: (propertyId: string) => `${ROUTES.PROPERTIES}/${propertyId}`,
  PROPERTY_EDIT: (propertyId: string) => `${ROUTES.PROPERTIES}/${propertyId}/edit`,
  CUSTOMER_DETAIL: (customerId: string) => `${ROUTES.CUSTOMERS}/${customerId}`,
  CUSTOMER_EDIT: (customerId: string) => `${ROUTES.CUSTOMERS}/${customerId}/edit`,
  INSTALLED_SYSTEM_DETAIL: (installedSystemId: string) =>
    `${ROUTES.INSTALLED_SYSTEMS}/${installedSystemId}`,
  INSTALLED_SYSTEM_EDIT: (installedSystemId: string) =>
    `${ROUTES.INSTALLED_SYSTEMS}/${installedSystemId}/edit`,
  COMPANY_BRAIN_NEW: () => `${ROUTES.COMPANY_BRAIN}/new`,
  COMPANY_BRAIN_EDIT: (id: string) => `${ROUTES.COMPANY_BRAIN}/${id}/edit`,
} as const;

// ─── Admin Routes ─────────────────────────────────────────────────────────────

export const ADMIN_BASE = "/admin";

export const ADMIN_ROUTES = {
  ROOT: ADMIN_BASE,
  ORGANIZATIONS: `${ADMIN_BASE}/organizations`,
  DB_HEALTH: `${ADMIN_BASE}/db-health`,
  CUSTOMERS: `${ADMIN_BASE}/customers`,
  PROPERTIES: `${ADMIN_BASE}/properties`,
  JOBS: `${ADMIN_BASE}/jobs`,
  // Import pages per entity
  IMPORT_CUSTOMERS: `${ADMIN_BASE}/customers/import`,
  IMPORT_PROPERTIES: `${ADMIN_BASE}/properties/import`,
  IMPORT_JOBS: `${ADMIN_BASE}/jobs/import`,
} as const;

// ─── Project Portal Routes ────────────────────────────────────────────────────

export const PORTAL_BASE = "/portal";

export const PORTAL_ROUTES = {
  HOME: PORTAL_BASE,
  /** Alias used by Sidebar and Sprint 22A components */
  ROOT: PORTAL_BASE,
  PROJECT: (projectId: string) => `${PORTAL_BASE}/${projectId}`,
  /** Sprint 22A overview route (/portal/[id]/overview) */
  OVERVIEW: (projectId: string) => `${PORTAL_BASE}/${projectId}/overview`,
  TIMELINE: (projectId: string) => `${PORTAL_BASE}/${projectId}/timeline`,
  DOCUMENTS: (projectId: string) => `${PORTAL_BASE}/${projectId}/documents`,
  PHOTOS: (projectId: string) => `${PORTAL_BASE}/${projectId}/photos`,
  CONTACT: (projectId: string) => `${PORTAL_BASE}/${projectId}/contact`,
  NOTIFICATIONS: (projectId: string) => `${PORTAL_BASE}/${projectId}/notifications`,
  ERROR_UNAUTHORIZED: "/portal/error/unauthorized",
  ERROR_EXPIRED_INVITE: "/portal/error/expired-invite",
  ERROR_REVOKED: "/portal/error/revoked",
  ERROR_NOT_FOUND: "/portal/error/not-found",
} as const;
