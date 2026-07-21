export const ROUTES = {
  HOME: "/",
  SIGN_IN: "/sign-in",
  DASHBOARD: "/dashboard",
  OPERATIONS: "/operations",
  PROPERTIES: "/properties",
  JOBS: "/jobs",
  CONTRACTORS: "/contractors",
  CUSTOMERS: "/customers",
  INSTALLED_SYSTEMS: "/installed-systems",
  VEHICLE_ALERTS: "/vehicle-alerts",
  DAILY_PLANS: "/daily-plans",
  LIVE_OPERATIONS: "/live-operations",
  INVENTORY: "/inventory",
  DISPATCH: "/dispatch",
  COMPANY_BRAIN: "/company-brain",
  REPORTING: "/reporting",
  SETTINGS: "/settings",
} as const;

export const ROUTE_BUILDERS = {
  JOB_DETAIL: (jobId: string) => `${ROUTES.JOBS}/${jobId}`,
  JOB_EDIT: (jobId: string) => `${ROUTES.JOBS}/${jobId}/edit`,
  PROPERTY_DETAIL: (propertyId: string) => `${ROUTES.PROPERTIES}/${propertyId}`,
  CUSTOMER_DETAIL: (customerId: string) => `${ROUTES.CUSTOMERS}/${customerId}`,
  CUSTOMER_EDIT: (customerId: string) => `${ROUTES.CUSTOMERS}/${customerId}/edit`,
  INSTALLED_SYSTEM_DETAIL: (installedSystemId: string) =>
    `${ROUTES.INSTALLED_SYSTEMS}/${installedSystemId}`,
} as const;

// ─── Admin Routes ─────────────────────────────────────────────────────────────

export const ADMIN_BASE = "/admin";

export const ADMIN_ROUTES = {
  ROOT: ADMIN_BASE,
  ORGANIZATIONS: `${ADMIN_BASE}/organizations`,
  CUSTOMERS: `${ADMIN_BASE}/customers`,
  PROPERTIES: `${ADMIN_BASE}/properties`,
  JOBS: `${ADMIN_BASE}/jobs`,
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
