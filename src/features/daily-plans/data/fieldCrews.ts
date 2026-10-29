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

function technicianName(profile: TechnicianRecord): string {
  return clean(profile.full_name) || clean(profile.email) || "Technician";
}

/**
 * Builds the daily-plan roster from database crews, technician profiles, and
 * names already assigned on jobs. Truck checks, departure times, and helper
 * names are included only when a crew record actually has them.
 */
export function buildFieldCrews(input: {
  crews: CrewRecord[];
  technicians: TechnicianRecord[];
  assignedNames: string[];
}): CrewProfile[] {
  const crews: CrewProfile[] = [];
  const seen = new Set<string>();

  for (const crew of input.crews) {
    const lead = clean(crew.lead_installer) || clean(crew.name);
    if (!lead) continue;
    const key = nameKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);
    const helper = firstHelper(crew.members);
    crews.push({
      id: crew.id,
      technician: lead,
      leadInstaller: lead,
      helper,
      truckName: clean(crew.truck_name) || "—",
      truckInService: true,
      certifications: Array.isArray(crew.certifications) ? crew.certifications.filter(Boolean) : [],
      experienceLevel: clean(crew.name) && clean(crew.name) !== lead ? crew.name : "Crew",
      availability: mapCrewAvailability(crew.availability),
      dailyCapacityHours: 0,
      departureTime: "—",
      truckChecks: [],
      rosterOnly: false,
    });
  }

  for (const technician of input.technicians) {
    const name = technicianName(technician);
    const key = nameKey(name);
    if (!key || key === "technician" || seen.has(key)) continue;
    seen.add(key);
    crews.push({
      id: technician.id,
      technician: name,
      leadInstaller: name,
      truckName: "—",
      truckInService: true,
      certifications: [],
      experienceLevel: "Technician",
      availability: "available",
      dailyCapacityHours: 0,
      departureTime: "—",
      truckChecks: [],
      rosterOnly: true,
    });
  }

  for (const assignedName of input.assignedNames) {
    const name = clean(assignedName);
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    crews.push({
      id: `assigned-${key}`,
      technician: name,
      leadInstaller: name,
      truckName: "—",
      truckInService: true,
      certifications: [],
      experienceLevel: "Assigned on a job",
      availability: "available",
      dailyCapacityHours: 0,
      departureTime: "—",
      truckChecks: [],
      rosterOnly: true,
    });
  }

  return crews.sort((left, right) => left.technician.localeCompare(right.technician));
}
