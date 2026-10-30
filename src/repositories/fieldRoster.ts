import "server-only";

import type { CrewRecord, TechnicianRecord } from "@/features/daily-plans/data/fieldCrews";
import type { Crew } from "@/features/dispatch/types/dispatch";

import { listCrews } from "./dispatch";
import { getRepositoryContext } from "./supabaseContext";

export interface FieldRoster {
  crews: CrewRecord[];
  technicians: TechnicianRecord[];
}

function asTechnician(row: Record<string, unknown>): TechnicianRecord | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;
  return {
    id,
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    email: typeof row.email === "string" ? row.email : null,
  };
}

function asCrewRecord(crew: Crew): CrewRecord {
  return {
    id: crew.id,
    name: crew.name,
    lead_installer: crew.leadInstaller,
    members: crew.members,
    certifications: crew.certifications,
    availability: crew.availability,
    truck_name: crew.truckName,
  };
}

/**
 * Crew records already used by dispatch, plus technician profiles.
 * A missing crews table or a blocked profile read returns an empty list
 * for that source instead of failing the whole roster.
 */
export async function loadFieldRoster(): Promise<FieldRoster> {
  const { supabase, orgId } = await getRepositoryContext();
  const crewResult = await listCrews({ page: 1, pageSize: 200 });

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,full_name")
    .eq("org_id", orgId)
    .eq("app_role", "tech");

  const technicians = error
    ? []
    : ((data ?? []) as Record<string, unknown>[])
        .map(asTechnician)
        .filter((technician): technician is TechnicianRecord => technician !== null);

  return {
    crews: crewResult.ok ? crewResult.data.map(asCrewRecord) : [],
    technicians,
  };
}
