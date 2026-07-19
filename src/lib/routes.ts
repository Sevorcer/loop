export const ROUTES = {
  DASHBOARD: "/dashboard",
  PROPERTIES: "/properties",
  JOBS: "/jobs",
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

<<<<<<< HEAD
// ─── Project Portal Routes ────────────────────────────────────────────────────

export const PORTAL_BASE = "/portal";

export const PORTAL_ROUTES = {
  HOME: PORTAL_BASE,
  PROJECT: (projectId: string) => `${PORTAL_BASE}/${projectId}`,
  TIMELINE: (projectId: string) => `${PORTAL_BASE}/${projectId}/timeline`,
  DOCUMENTS: (projectId: string) => `${PORTAL_BASE}/${projectId}/documents`,
  PHOTOS: (projectId: string) => `${PORTAL_BASE}/${projectId}/photos`,
  CONTACT: (projectId: string) => `${PORTAL_BASE}/${projectId}/contact`,
  NOTIFICATIONS: (projectId: string) => `${PORTAL_BASE}/${projectId}/notifications`,
=======
// ─── Project Portal (external-facing) ────────────────────────────────────────

export const PORTAL_ROUTES = {
  /** Root redirect — navigates to the first available project for the mock user */
  ROOT: "/portal",

  /** Per-project screens */
  OVERVIEW: (projectId: string) => `/portal/${projectId}/overview`,
  TIMELINE: (projectId: string) => `/portal/${projectId}/timeline`,
  DOCUMENTS: (projectId: string) => `/portal/${projectId}/documents`,
  CONTACT: (projectId: string) => `/portal/${projectId}/contact`,

  /** Error states */
  ERROR_UNAUTHORIZED: "/portal/error/unauthorized",
  ERROR_EXPIRED_INVITE: "/portal/error/expired-invite",
  ERROR_REVOKED: "/portal/error/revoked",
  ERROR_NOT_FOUND: "/portal/error/not-found",
>>>>>>> origin/main
} as const;
