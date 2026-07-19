import type { PortalUser } from "../types/portal";
import { MOCK_ORG_A, MOCK_ORG_B } from "./mockProjects";

/**
 * Mock portal users — one representative per MVP role.
 * Used to demonstrate role gating and permission resolution in local dev.
 */
export const mockPortalUsers: PortalUser[] = [
  {
    id: "user-homeowner-001",
    displayName: "Alex Rivera",
    email: "alex.rivera@email.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["homeowner"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
    ],
  },
  {
    id: "user-gc-001",
    displayName: "Jordan Nakamura",
    email: "jordan@metroconstruction.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["general_contractor"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
      {
        organizationId: MOCK_ORG_B,
        organizationName: "Metro Construction Group",
        roles: ["general_contractor"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
    ],
  },
  {
    id: "user-builder-001",
    displayName: "Morgan Park",
    email: "mpark@orionbuilders.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["builder_developer"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
    ],
  },
  {
    id: "user-pm-001",
    displayName: "Taylor Singh",
    email: "taylor@summitproperties.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["property_manager"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
    ],
  },
  {
    id: "user-multi-role-001",
    displayName: "Casey Turner",
    email: "casey@orionbuilders.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        // Holds both GC and Builder — union of resource visibility applies
        roles: ["general_contractor", "builder_developer"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
    ],
  },
  {
    id: "user-expired-invite-001",
    displayName: "Sam Ortiz",
    email: "sam@example.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["homeowner"],
        inviteExpiresAt: "2026-07-01T00:00:00.000Z", // past — expired
        isRevoked: false,
      },
    ],
  },
  {
    id: "user-revoked-001",
    displayName: "Riley Okafor",
    email: "riley@example.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["homeowner"],
        inviteExpiresAt: null,
        isRevoked: true,
      },
    ],
  },
];

/**
 * The active mock user shown in the portal dev preview.
 * Change this export to test different role experiences.
 */
export const MOCK_ACTIVE_USER: PortalUser = mockPortalUsers[0]; // homeowner by default
