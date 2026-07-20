import type { PortalProject, PortalUser } from "../types/portalTypes";

export function getPortalHomeProjects(
  user: PortalUser | null,
  projects: PortalProject[],
): PortalProject[] {
  if (!user) {
    return [];
  }

  return projects.filter((project) =>
    user.memberships.some((membership) => {
      if (!membership.active || membership.orgId !== project.orgId) {
        return false;
      }

      return (
        membership.projectIds.length === 0 ||
        membership.projectIds.includes(project.id)
      );
    }),
  );
}
