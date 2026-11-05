export const ROUTES = {
  HOME: "/",
  SIGN_IN: "/sign-in",
  UPDATE_PASSWORD: "/update-password",
  DASHBOARD: "/dashboard",
  /** Operations (formerly Command Center). The old /operations launcher hub was removed 2026-11-05. */
  OPERATIONS: "/operations",
  /** Legacy address — redirects to OPERATIONS. Kept so old bookmarks and saved settings resolve. */
  COMMAND_CENTER: "/command-center",
  /** Live view inside Operations (rebuilt on real data 2026-11-05). */
  OPERATIONS_LIVE: "/operations/live",
  PROPERTIES: "/properties",
  JOBS: "/jobs",
  CONTRACTORS: "/contractors",
  CUSTOMERS: "/customers",
  INSTALLED_SYSTEMS: "/installed-systems",
  VEHICLE_ALERTS: "/vehicle-alerts",
  DAILY_PLANS: "/daily-plans",
  CALENDAR: "/calendar",
  /** Legacy address — redirects to OPERATIONS_LIVE. */
  LIVE_OPERATIONS: "/live-operations",
  INVENTORY: "/inventory",
  DISPATCH: "/dispatch",
  COMPANY_BRAIN: "/company-brain",
  BILLING: "/billing",
  REPORTING: "/reporting",
  SETTINGS: "/settings",
  SETTINGS_USERS: "/settings/users",
  SETTINGS_APPEARANCE: "/settings/appearance",
  SETTINGS_ROLES: "/settings/roles",
  SETTINGS_FEEDBACK: "/settings/feedback",
  OPS_FEEDBACK: "/ops/feedback",
  GC_OVERVIEW: "/gc-overview",
  PERMITS_BOARD: "/permits",
  INSPECTIONS_WEEK: "/inspections",
} as const;

export const ROUTE_BUILDERS = {
  JOB_NEW: (context?: { customerId?: string; propertyId?: string; date?: string }) => {
    const params = new URLSearchParams();
    if (context?.customerId) params.set("customerId", context.customerId);
    if (context?.propertyId) params.set("propertyId", context.propertyId);
    if (context?.date) params.set("date", context.date);
    const query = params.toString();
    return query ? `${ROUTES.JOBS}/new?${query}` : `${ROUTES.JOBS}/new`;
  },
  JOB_DETAIL: (jobId: string) => `${ROUTES.JOBS}/${jobId}`,
  JOB_EDIT: (jobId: string) => `${ROUTES.JOBS}/${jobId}/edit`,
  PROPERTY_NEW: (context?: { customerId?: string }) => {
    const params = new URLSearchParams();
    if (context?.customerId) params.set("customerId", context.customerId);
    const query = params.toString();
    return query ? `${ROUTES.PROPERTIES}/new?${query}` : `${ROUTES.PROPERTIES}/new`;
  },
  PROPERTY_DETAIL: (propertyId: string) => `${ROUTES.PROPERTIES}/${propertyId}`,
  PROPERTY_EDIT: (propertyId: string) => `${ROUTES.PROPERTIES}/${propertyId}/edit`,
  CUSTOMER_DETAIL: (customerId: string) => `${ROUTES.CUSTOMERS}/${customerId}`,
  CUSTOMER_EDIT: (customerId: string) => `${ROUTES.CUSTOMERS}/${customerId}/edit`,
  INSTALLED_SYSTEM_NEW: (context?: {
    propertyId?: string;
    propertyName?: string;
    customerName?: string;
    jobId?: string;
    jobNumber?: string;
  }) => {
    const params = new URLSearchParams();
    if (context?.propertyId) params.set("propertyId", context.propertyId);
    if (context?.propertyName) params.set("propertyName", context.propertyName);
    if (context?.customerName) params.set("customerName", context.customerName);
    if (context?.jobId) params.set("jobId", context.jobId);
    if (context?.jobNumber) params.set("jobNumber", context.jobNumber);
    const query = params.toString();
    return query
      ? `${ROUTES.INSTALLED_SYSTEMS}/new?${query}`
      : `${ROUTES.INSTALLED_SYSTEMS}/new`;
  },
  INSTALLED_SYSTEM_DETAIL: (installedSystemId: string) =>
    `${ROUTES.INSTALLED_SYSTEMS}/${installedSystemId}`,
  INSTALLED_SYSTEM_EDIT: (installedSystemId: string) =>
    `${ROUTES.INSTALLED_SYSTEMS}/${installedSystemId}/edit`,
  COMPANY_BRAIN_NEW: () => `${ROUTES.COMPANY_BRAIN}/new`,
  COMPANY_BRAIN_MANUALS: () => `${ROUTES.COMPANY_BRAIN}/manuals`,
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
