"use client";

import {
  createContext,
<<<<<<< HEAD
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  mockPortalProjects,
  mockPortalUsers,
  DEMO_USER_ID,
} from "../data/mockPortalProjects";
import {
  mockMilestones,
  mockAppointments,
  mockDocuments,
  mockContacts,
  mockChangeOrders,
  mockPhotos,
  defaultNotificationPreferences,
} from "../data/mockPortalEvents";
import { checkAuthorization, filterVisibleDocuments, filterVisiblePhotos } from "../utils/portalAuth";
import { computeFreshness } from "../utils/freshnessUtils";
import type {
  PortalProject,
  PortalUser,
  PortalMilestone,
  PortalAppointment,
  PortalDocument,
  PortalPhoto,
  PortalContact,
  PortalChangeOrder,
  PortalPermissions,
  PortalRole,
  FreshnessState,
  AuthzResult,
  NotificationPreference,
  NotificationCategory,
  NotificationChannel,
} from "../types/portalTypes";
=======
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { buildProjection } from "../adapters/eventProjection";
import { mockEventStream } from "../data/mockEvents";
import { mockProjects } from "../data/mockProjects";
import { MOCK_ACTIVE_USER } from "../data/mockPortalUsers";
import type {
  AuthorizationResult,
  ContactTeamViewModel,
  PortalPermissionSet,
  PortalProjection,
  PortalRole,
  PortalUser,
} from "../types/portal";
import { authorizePortalAccess } from "../auth/portalAuth";
>>>>>>> origin/main

// ─── Context Shape ────────────────────────────────────────────────────────────

interface PortalContextValue {
<<<<<<< HEAD
  // Current session
  currentUser: PortalUser | null;
  currentProjectId: string | null;
  currentOrgId: string | null;

  // Authorization
  authz: AuthzResult | null;
  effectiveRoles: PortalRole[];
  permissions: PortalPermissions | null;

  // Project projection
  project: PortalProject | null;
  milestones: PortalMilestone[];
  appointments: PortalAppointment[];
  documents: PortalDocument[];
  photos: PortalPhoto[];
  contacts: PortalContact[];
  changeOrders: PortalChangeOrder[];

  // Freshness
  freshness: FreshnessState;

  // Notification preferences (Sprint 22B)
  notificationPreferences: NotificationPreference[];
  updateNotificationPreference: (
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean
  ) => void;

  // Navigation helpers
  setProject: (projectId: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PortalContext = createContext<PortalContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface PortalProviderProps {
  children: ReactNode;
  /** Pre-select a project — typically injected by server page params */
  projectId?: string;
}

const STORAGE_KEY_NOTIFICATIONS = "loop.portal.notification_prefs";

/**
 * PortalProvider is the state layer for the Project Portal domain.
 *
 * It derives role-filtered projection data from mock event fixtures and exposes
 * authorization, freshness state, and notification preferences to portal screens.
 *
 * Authorization and tenancy checks are centralized here — not in UI components.
 */
export function PortalProvider({ children, projectId: initialProjectId }: PortalProviderProps) {
  const currentUser = useMemo(
    () => mockPortalUsers.find((u) => u.id === DEMO_USER_ID) ?? null,
    []
  );

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    initialProjectId ?? null
  );

  // ── Notification Preferences ──────────────────────────────────────────────

  const [notificationPreferences, setNotificationPreferences] = useState<
    NotificationPreference[]
  >(() => {
    if (typeof window === "undefined") return defaultNotificationPreferences;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (stored) return JSON.parse(stored) as NotificationPreference[];
    } catch {
      // ignore parse errors
    }
    return defaultNotificationPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notificationPreferences));
    } catch {
      // ignore storage errors
    }
  }, [notificationPreferences]);

  const updateNotificationPreference = useCallback(
    (category: NotificationCategory, channel: NotificationChannel, enabled: boolean) => {
      setNotificationPreferences((prev) =>
        prev.map((pref) => {
          if (pref.category !== category) return pref;
          return {
            ...pref,
            channels: pref.channels.map((ch) =>
              ch.channel === channel ? { ...ch, enabled } : ch
            ),
          };
        })
      );
    },
    []
  );

  // ── Project Resolution ────────────────────────────────────────────────────

  const project = useMemo(
    () =>
      currentProjectId
        ? mockPortalProjects.find((p) => p.id === currentProjectId) ?? null
        : null,
    [currentProjectId]
  );

  const currentOrgId = project?.orgId ?? null;

  // ── Authorization ─────────────────────────────────────────────────────────

  const authz = useMemo((): AuthzResult | null => {
    if (!currentUser || !currentProjectId || !currentOrgId) return null;

    return checkAuthorization({
      user: currentUser,
      orgId: currentOrgId,
      projectId: currentProjectId,
      projectExists: project !== null,
      // In the mock layer, invitations are always active for active memberships
      inviteActive: true,
    });
  }, [currentUser, currentProjectId, currentOrgId, project]);

  const effectiveRoles = useMemo(() => authz?.effectiveRoles ?? [], [authz]);
  const permissions = useMemo(() => authz?.permissions ?? null, [authz]);

  // ── Freshness ─────────────────────────────────────────────────────────────

  const freshness = useMemo(
    () => computeFreshness(project?.lastSyncedAt ?? null),
    [project]
  );

  // ── Filtered Projections ──────────────────────────────────────────────────

  const milestones = useMemo(() => {
    if (!currentProjectId || !authz?.granted || !permissions?.canViewTimeline) return [];
    return mockMilestones
      .filter((m) => m.projectId === currentProjectId)
      .sort((a, b) => a.sequence - b.sequence);
  }, [currentProjectId, authz, permissions]);

  const appointments = useMemo(() => {
    if (!currentProjectId || !authz?.granted || !permissions?.canViewAppointments) return [];
    return mockAppointments.filter((a) => a.projectId === currentProjectId);
  }, [currentProjectId, authz, permissions]);

  const documents = useMemo(() => {
    if (!currentProjectId || !authz?.granted || !permissions?.canViewDocuments) return [];
    const projectDocs = mockDocuments.filter((d) => d.projectId === currentProjectId);
    return filterVisibleDocuments(projectDocs, effectiveRoles);
  }, [currentProjectId, authz, permissions, effectiveRoles]);

  const photos = useMemo(() => {
    if (!currentProjectId || !authz?.granted || !permissions?.canViewPhotos) return [];
    if (!project?.photosEnabled) return [];
    const projectPhotos = mockPhotos.filter((p) => p.projectId === currentProjectId);
    return filterVisiblePhotos(projectPhotos, effectiveRoles, project.photosEnabled);
  }, [currentProjectId, authz, permissions, effectiveRoles, project]);

  const contacts = useMemo(() => {
    if (!currentProjectId || !authz?.granted || !permissions?.canViewContact) return [];
    return mockContacts.filter((c) => c.projectId === currentProjectId);
  }, [currentProjectId, authz, permissions]);

  const changeOrders = useMemo(() => {
    if (!currentProjectId || !authz?.granted || !permissions?.canViewChangeOrders) return [];
    return mockChangeOrders.filter((co) => co.projectId === currentProjectId);
  }, [currentProjectId, authz, permissions]);

  // ── Project Prefs filtered by current project ─────────────────────────────

  const projectNotificationPreferences = useMemo(
    () =>
      currentProjectId
        ? notificationPreferences.filter((p) => p.projectId === currentProjectId)
        : notificationPreferences,
    [notificationPreferences, currentProjectId]
  );

  return (
    <PortalContext.Provider
      value={{
        currentUser,
        currentProjectId,
        currentOrgId,
        authz,
        effectiveRoles,
        permissions,
        project,
        milestones,
        appointments,
        documents,
        photos,
        contacts,
        changeOrders,
        freshness,
        notificationPreferences: projectNotificationPreferences,
        updateNotificationPreference,
        setProject: setCurrentProjectId,
      }}
    >
      {children}
    </PortalContext.Provider>
=======
  /** The currently authenticated portal user (mock in Sprint 22A). */
  user: PortalUser;
  /** The resolved authorization result for this project. */
  authResult: AuthorizationResult;
  /** Resolved permission set (only set when authResult.ok === true). */
  permissionSet: PortalPermissionSet | null;
  /** Active roles for this org context. */
  resolvedRoles: PortalRole[];
  /** Fully built projection for this project. */
  projection: PortalProjection;
  /** The projectId this context was initialized for. */
  projectId: string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

// ─── Static contact team data ─────────────────────────────────────────────────
// In production this would come from the project record or a contacts service.

function buildContactTeam(
  projectId: string,
  projectManagerName: string,
  projectManagerPhone: string,
  projectManagerEmail: string,
): ContactTeamViewModel {
  return {
    projectId,
    contacts: [
      {
        role: "Project Manager",
        name: projectManagerName,
        phone: projectManagerPhone,
        email: projectManagerEmail,
      },
      {
        role: "Office",
        name: "SunState HVAC Office",
        phone: "555-100-0000",
        email: "office@sunstatehvac.com",
      },
      {
        role: "Emergency",
        name: "24/7 Emergency Line",
        phone: "555-100-9911",
        email: "",
      },
    ],
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface PortalProviderProps {
  projectId: string;
  children: ReactNode;
}

export function PortalProvider({ projectId, children }: PortalProviderProps) {
  const value = useMemo<PortalContextValue>(() => {
    const user = MOCK_ACTIVE_USER;

    // Find the project in the projection store
    const project = mockProjects.find((p) => p.id === projectId) ?? null;

    // Authorize access
    const authResult = project
      ? authorizePortalAccess(user, project)
      : { ok: false as const, errorCode: "missing_project" as const };

    const permissionSet =
      authResult.ok ? authResult.permissionSet : null;
    const resolvedRoles =
      authResult.ok ? authResult.resolvedRoles : [];

    // Build projection from mock event stream
    const rawProjection = buildProjection({
      projectId,
      events: mockEventStream,
    });

    // Attach project and contact team to projection
    const projection: PortalProjection = {
      ...rawProjection,
      project,
      contactTeam:
        project
          ? buildContactTeam(
              projectId,
              project.projectManagerName,
              project.projectManagerPhone,
              project.projectManagerEmail,
            )
          : null,
    };

    return {
      user,
      authResult,
      permissionSet,
      resolvedRoles,
      projection,
      projectId,
    };
  }, [projectId]);

  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
>>>>>>> origin/main
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
<<<<<<< HEAD
    throw new Error("usePortal must be used inside <PortalProvider>");
=======
    throw new Error("usePortal must be used within a PortalProvider");
>>>>>>> origin/main
  }
  return ctx;
}
