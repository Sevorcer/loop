"use client";

import {
  createContext,
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

// ─── Context Shape ────────────────────────────────────────────────────────────

interface PortalContextValue {
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
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used inside <PortalProvider>");
  }
  return ctx;
}
