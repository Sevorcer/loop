"use client";

import {
  createContext,
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

// ─── Context Shape ────────────────────────────────────────────────────────────

interface PortalContextValue {
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
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used within a PortalProvider");
  }
  return ctx;
}
