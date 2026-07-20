import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import PortalHomePage from "@/app/portal/page";
import PortalOverviewPage from "@/app/portal/[projectId]/page";
import {
  DEMO_USER_ID,
  mockPortalProjects,
  mockPortalUsers,
} from "../data/mockPortalProjects";
import { getPortalHomeProjects } from "../utils/portalHome";

describe("portal home routing", () => {
  it("renders the portal home instead of redirecting to a default project", () => {
    expect(() => PortalHomePage()).not.toThrow();
    expect(isValidElement(PortalHomePage())).toBe(true);
  });

  it("keeps the project overview route renderable", () => {
    expect(isValidElement(PortalOverviewPage())).toBe(true);
  });
});

describe("getPortalHomeProjects", () => {
  it("returns selectable projects for the current demo user", () => {
    const currentUser =
      mockPortalUsers.find((user) => user.id === DEMO_USER_ID) ?? null;

    expect(getPortalHomeProjects(currentUser, mockPortalProjects)).toEqual([
      mockPortalProjects[0],
    ]);
  });

  it("returns an empty state dataset when the user has no active project access", () => {
    expect(
      getPortalHomeProjects(
        {
          id: "user-none",
          name: "No Access",
          email: "none@example.com",
          memberships: [{ orgId: "org-001", roles: ["homeowner"], projectIds: ["proj-9999"], active: true }],
        },
        mockPortalProjects,
      ),
    ).toEqual([]);
  });
});
