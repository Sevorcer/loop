import type { Crew } from "../types/dispatch";

/**
 * Mock crew records for the Dispatch domain.
 * Dispatch references crews — it does not own them.
 *
 * These crew profiles align with the crew data used in Morning Operations
 * (daily-plans/data/mockMorningOperations.ts) so the domains share a
 * consistent view of company field resources.
 */
export const mockCrews: Crew[] = [
  {
    id: "crew-marcus-rivera",
    name: "Rivera Install Crew",
    leadInstaller: "Marcus Rivera",
    members: [
      { id: "tech-marcus-rivera", name: "Marcus Rivera", role: "lead" },
      { id: "tech-elena-cruz", name: "Elena Cruz", role: "installer" },
    ],
    certifications: ["Heat Pump", "Rigging", "Startup"],
    availability: "available",
    truckName: "Install Truck 4",
  },
  {
    id: "crew-tina-brooks",
    name: "Brooks Service Crew",
    leadInstaller: "Tina Brooks",
    members: [
      { id: "tech-tina-brooks", name: "Tina Brooks", role: "lead" },
      { id: "tech-maya-singh", name: "Maya Singh", role: "installer" },
    ],
    certifications: ["Service", "EPA Universal"],
    availability: "available",
    truckName: "Service Van 2",
  },
  {
    id: "crew-jordan-lee",
    name: "Lee Commercial Crew",
    leadInstaller: "Jordan Lee",
    members: [
      { id: "tech-jordan-lee", name: "Jordan Lee", role: "lead" },
      { id: "tech-chris-doyle", name: "Chris Doyle", role: "installer" },
    ],
    certifications: ["Commercial RTU", "Controls"],
    availability: "on_job",
    truckName: "Service Truck 7",
  },
  {
    id: "crew-riley-morgan",
    name: "Morgan Install Crew",
    leadInstaller: "Riley Morgan",
    members: [
      { id: "tech-riley-morgan", name: "Riley Morgan", role: "lead" },
      { id: "tech-alex-park", name: "Alex Park", role: "helper" },
    ],
    certifications: ["Ductless", "Commissioning"],
    availability: "available",
    truckName: "Install Van 6",
  },
];
