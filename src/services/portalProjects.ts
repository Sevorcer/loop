import "server-only";

/**
 * Portal projects service — Sprint 27 #58/#59
 *
 * Orchestrates portal project data fetched from Supabase.
 * Replaces mockPortalProjects and fakePortalArtifacts in production paths.
 */

import type {
  PortalDocument,
  PortalMilestone,
  PortalPhoto,
  PortalProject,
} from "@/features/project-portal/types/portalTypes";

import {
  getPortalProjectById,
  listPortalDocuments,
  listPortalMilestones,
  listPortalPhotos,
  listPortalProjects,
} from "@/repositories/portalProjects";

export type { PortalProject, PortalMilestone, PortalDocument, PortalPhoto };

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getPortalProjects(): Promise<PortalProject[]> {
  return listPortalProjects();
}

export async function getPortalProject(id: string): Promise<PortalProject | null> {
  return getPortalProjectById(id);
}

export async function getPortalMilestones(projectId: string): Promise<PortalMilestone[]> {
  return listPortalMilestones(projectId);
}

export async function getPortalDocuments(projectId: string): Promise<PortalDocument[]> {
  return listPortalDocuments(projectId);
}

export async function getPortalPhotos(
  projectId: string,
  customerVisibleOnly = false,
): Promise<PortalPhoto[]> {
  return listPortalPhotos(projectId, customerVisibleOnly);
}

/**
 * Loads all data for a single project in parallel — used by the PortalProvider
 * when navigating to a specific project.
 */
export async function getPortalProjectBundle(projectId: string) {
  const [project, milestones, documents, photos] = await Promise.all([
    getPortalProjectById(projectId),
    listPortalMilestones(projectId),
    listPortalDocuments(projectId),
    listPortalPhotos(projectId),
  ]);

  return { project, milestones, documents, photos };
}
