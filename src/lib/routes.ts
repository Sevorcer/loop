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
} as const;
