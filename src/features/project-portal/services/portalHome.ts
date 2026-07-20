import {
  DEMO_USER_ID,
  mockPortalProjects,
  mockPortalUsers,
} from "../data/mockPortalProjects";
import { getPortalHomeProjects } from "../utils/portalHome";

export function getPortalHomeData() {
  const currentUser =
    mockPortalUsers.find((user) => user.id === DEMO_USER_ID) ?? null;

  return {
    currentUser,
    projects: getPortalHomeProjects(currentUser, mockPortalProjects),
  };
}
