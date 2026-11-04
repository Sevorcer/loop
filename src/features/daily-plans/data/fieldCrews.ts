import type { CrewAvailabilityState, CrewProfile } from "../types/dailyPlan";

export interface CrewRecord {
  id: string;
  name: string;
  lead_installer: string;
  members: unknown;
  certifications: string[] | null;
  availability: string;
  truck_name: string;
}

export interface TechnicianRecord {
  id: string;
  full_name: string | null;
  email: string | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function nameKey(value: string): string {
  return value.trim().toLowerCase();
}

function firstHelper(members: unknown): string | undefined {
  if (!Array.isArray(members)) return undefined;
  for (const member of members) {
    if (typeof member === "string" && member.trim()) return member.trim();
    if (member && typeof member === "object" && "name" in member) {
      const name = (member as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return undefined;
}

function allMembers(members: unknown): string[] {
  const result: string[] = [];
  if (!Array.isArray(members)) return result;
  for (const member of members) {
    if (typeof member === "string" && member.trim()) {
      result.push(member.trim());
    } else if (member && typeof member === "object" && "name" in member) {
      const name = (member as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) result.push(name.trim());
    }
  }
  return result;
}

export function mapCrewAvailability(value: string): CrewAvailabilityState {
  switch (value.trim().toLowerCase()) {
    case "available":
    case "on_job":
      return "available";
    case "partially_available":
    case "partially available":
      return "half day";
    case "unavailable":
      return "unavailable";
    case "vacation":
      return "vacation";
    case "sick":
      return "sick";
    case "training":
      return "training";
    case "late arrival":
    case "late_arrival":
      return "late arrival";
    default:
      return "available";
  }
}

export interface CrewGroup {
  crew: CrewProfile;
  /** Names of people assigned today who belong to this crew. */
  assignedMembers: string[];
}

export interface DailyCrewRoster {
  /** Crew records that have at least one member assigned today. */
  crewGroups: CrewGroup[];
  /** People assigned today who don't belong to any crew record. */
  floaters: string[];
  /** Flat list of all people working today (for assignment dropdowns). */
  allProfiles: CrewProfile[];
}

/**
 * Builds the daily crew roster from crew records and today's assigned names.
 *
 * Only people assigned to today's jobs appear. They are grouped under the crew
 * record whose lead or members match. Anyone assigned today who belongs to no
 * crew record appears in the "Also working today" floater list with no invented
 * truck, availability, or departure fields.
 */
export function buildDailyCrewRoster(input: {
  crews: CrewRecord[];
  assignedNames: string[];
}): DailyCrewRoster {
  // Deduplicate and clean assigned names
  const assignedSet = new Set<string>();
  const assignedClean: string[] = [];
  for (const raw of input.assignedNames) {
    const name = clean(raw);
    if (!name) continue;
    const key = nameKey(name);
    if (assignedSet.has(key)) continue;
    assignedSet.add(key);
    assignedClean.push(name);
  }

  if (assignedClean.length === 0) {
    return { crewGroups: [], floaters: [], allProfiles: [] };
  }

  // Build a lookup: nameKey -> canonical assigned name
  const assignedByKey = new Map<string, string>();
  for (const name of assignedClean) {
    assignedByKey.set(nameKey(name), name);
  }

  // Track which assigned people have been claimed by a crew
  const claimed = new Set<string>();
  const crewGroups: CrewGroup[] = [];

  for (const crew of input.crews) {
    const lead = clean(crew.lead_installer) || clean(crew.name);
    if (!lead) continue;

    // Collect all people in this crew record
    const crewMembers = [lead, ...allMembers(crew.members)];
    const assignedInCrew: string[] = [];

    for (const member of crewMembers) {
      const key = nameKey(member);
      const assignedName = assignedByKey.get(key);
      if (assignedName && !claimed.has(key)) {
        assignedInCrew.push(assignedName);
        claimed.add(key);
      }
    }

    // Only include crews that have at least one member assigned today
    if (assignedInCrew.length === 0) continue;

    const helper = firstHelper(crew.members);

    crewGroups.push({
      crew: {
        id: crew.id,
        technician: lead,
        leadInstaller: lead,
        helper,
        truckName: clean(crew.truck_name) || "—",
        truckInService: true,
        certifications: Array.isArray(crew.certifications)
          ? crew.certifications.filter(Boolean)
          : [],
        experienceLevel:
          clean(crew.name) && clean(crew.name) !== lead ? crew.name : "Crew",
        availability: mapCrewAvailability(crew.availability),
        dailyCapacityHours: 0,
        departureTime: "—",
        truckChecks: [],
      },
      assignedMembers: assignedInCrew,
    });
  }

  // Floaters: assigned people not claimed by any crew
  const floaters: string[] = [];
  for (const name of assignedClean) {
    if (!claimed.has(nameKey(name))) {
      floaters.push(name);
    }
  }

  // Build flat allProfiles for assignment dropdowns
  const allProfiles: CrewProfile[] = [
    ...crewGroups.map((g) => g.crew),
    ...floaters.map((name) => ({
      id: `floater-${nameKey(name)}`,
      technician: name,
      leadInstaller: name,
      truckName: "—",
      truckInService: true,
      certifications: [] as string[],
      experienceLevel: "Also working today",
      availability: "available" as const,
      dailyCapacityHours: 0,
      departureTime: "—",
      truckChecks: [] as { label: string; ready: boolean; critical?: boolean }[],
    })),
  ];

  // Sort groups and floaters alphabetically
  crewGroups.sort((a, b) => a.crew.technician.localeCompare(b.crew.technician));
  floaters.sort((a, b) => a.localeCompare(b));
  allProfiles.sort((a, b) => a.technician.localeCompare(b.technician));

  return { crewGroups, floaters, allProfiles };
}
