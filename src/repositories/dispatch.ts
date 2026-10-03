import "server-only";

import type {
  AssignmentStatus,
  Crew,
  CrewAssignment,
  DispatchEvent,
  DispatchEventType,
  DispatchPlan,
  DispatchPriority,
  DispatchStatus,
  ReassignmentRecord,
  ScheduleBlock,
} from "@/features/dispatch/types/dispatch";

import { wrapRepositoryError } from "./shared";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface CrewRow {
  id: string;
  org_id: string;
  name: string;
  lead_installer: string;
  members: unknown;
  certifications: string[];
  availability: string;
  truck_name: string;
}

interface DispatchPlanRow {
  id: string;
  org_id: string;
  job_id: string | null;
  job_number: string;
  customer_name: string;
  property_name: string;
  job_type: string;
  dispatch_status: string;
  dispatchability: unknown;
  target_date: string | null;
  estimated_duration_hours: number;
  priority: string;
  sequencing_notes: string | null;
  constraints: unknown;
  created_at: string;
  updated_at: string;
}

interface CrewAssignmentRow {
  id: string;
  org_id: string;
  dispatch_plan_id: string;
  job_id: string | null;
  crew_id: string;
  crew_name: string;
  lead_installer: string;
  supporting_technicians: string[];
  status: string;
  assigned_at: string;
  reassignment_history: unknown;
}

interface ScheduleBlockRow {
  id: string;
  org_id: string;
  dispatch_plan_id: string;
  job_id: string | null;
  crew_assignment_id: string | null;
  crew_name: string;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  estimated_duration_hours: number;
  job_type: string;
  customer_name: string;
  property_name: string;
  dispatch_status: string;
}

interface DispatchEventRow {
  id: string;
  org_id: string;
  dispatch_plan_id: string;
  type: string;
  timestamp: string;
  description: string;
  metadata: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapCrew(row: CrewRow): Crew {
  return {
    id: row.id,
    name: row.name,
    leadInstaller: row.lead_installer,
    members: (row.members as Crew["members"]) ?? [],
    certifications: row.certifications ?? [],
    availability: row.availability as Crew["availability"],
    truckName: row.truck_name,
  };
}

function mapDispatchPlan(row: DispatchPlanRow): DispatchPlan {
  return {
    id: row.id,
    jobId: row.job_id ?? "",
    jobNumber: row.job_number,
    customerName: row.customer_name,
    propertyName: row.property_name,
    jobType: row.job_type,
    dispatchStatus: row.dispatch_status as DispatchStatus,
    dispatchability: (row.dispatchability as DispatchPlan["dispatchability"]) ?? {
      isDispatchable: false,
      materialReadiness: { state: "not_satisfied", reason: "" },
      technicalReadiness: { state: "not_satisfied", reason: "" },
      customerReadiness: { state: "not_satisfied", reason: "" },
      crewReadiness: { state: "not_satisfied", reason: "" },
    },
    targetDate: row.target_date ?? "",
    estimatedDurationHours: row.estimated_duration_hours,
    priority: row.priority as DispatchPriority,
    sequencingNotes: row.sequencing_notes ?? undefined,
    constraints: (row.constraints as DispatchPlan["constraints"]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCrewAssignment(row: CrewAssignmentRow): CrewAssignment {
  return {
    id: row.id,
    dispatchPlanId: row.dispatch_plan_id,
    jobId: row.job_id ?? "",
    crewId: row.crew_id,
    crewName: row.crew_name,
    leadInstaller: row.lead_installer,
    supportingTechnicians: row.supporting_technicians ?? [],
    status: row.status as AssignmentStatus,
    assignedAt: row.assigned_at,
    reassignmentHistory: (row.reassignment_history as ReassignmentRecord[]) ?? [],
  };
}

function mapScheduleBlock(row: ScheduleBlockRow): ScheduleBlock {
  return {
    id: row.id,
    dispatchPlanId: row.dispatch_plan_id,
    jobId: row.job_id ?? "",
    crewAssignmentId: row.crew_assignment_id ?? "",
    crewName: row.crew_name,
    scheduledDate: row.scheduled_date,
    scheduledStartTime: row.scheduled_start_time,
    scheduledEndTime: row.scheduled_end_time,
    estimatedDurationHours: row.estimated_duration_hours,
    jobType: row.job_type,
    customerName: row.customer_name,
    propertyName: row.property_name,
    dispatchStatus: row.dispatch_status as DispatchStatus,
  };
}

function mapDispatchEvent(row: DispatchEventRow): DispatchEvent {
  return {
    id: row.id,
    dispatchPlanId: row.dispatch_plan_id,
    type: row.type as DispatchEventType,
    timestamp: row.timestamp,
    description: row.description,
    metadata: row.metadata ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// CRUD — Crews
// ---------------------------------------------------------------------------

export async function listCrews(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("crews")
      .select("id,org_id,name,lead_installer,members,certifications,availability,truck_name")
      .eq("org_id", orgId)
      .order("name")
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as CrewRow[]).map(mapCrew);
  });
}

export interface CrewWriteInput {
  name: string;
  leadInstaller: string;
  members: Crew["members"];
  certifications: string[];
  availability: Crew["availability"];
  truckName: string;
}

export async function createCrew(input: CrewWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("crews")
      .insert({
        org_id: orgId,
        name: input.name,
        lead_installer: input.leadInstaller,
        members: input.members,
        certifications: input.certifications,
        availability: input.availability,
        truck_name: input.truckName,
      })
      .select("id,org_id,name,lead_installer,members,certifications,availability,truck_name")
      .single();

    if (error) throw new Error(error.message);
    return mapCrew(data as CrewRow);
  });
}

// ---------------------------------------------------------------------------
// CRUD — Dispatch Plans
// ---------------------------------------------------------------------------

export async function listDispatchPlans(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_plans")
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as DispatchPlanRow[]).map(mapDispatchPlan);
  });
}

export async function listDispatchPlansByJobId(jobId: string, options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_plans")
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      )
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .order("target_date", { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as DispatchPlanRow[]).map(mapDispatchPlan);
  });
}

export async function getDispatchPlanById(id: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_plans")
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      )
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapDispatchPlan(data as DispatchPlanRow) : null;
  });
}

export interface DispatchPlanWriteInput {
  jobId?: string;
  jobNumber: string;
  customerName: string;
  propertyName: string;
  jobType: string;
  dispatchStatus: DispatchStatus;
  dispatchability: DispatchPlan["dispatchability"];
  targetDate?: string;
  estimatedDurationHours: number;
  priority: DispatchPriority;
  sequencingNotes?: string;
  constraints: DispatchPlan["constraints"];
}

export async function createDispatchPlan(input: DispatchPlanWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_plans")
      .insert({
        org_id: orgId,
        job_id: input.jobId ?? null,
        job_number: input.jobNumber,
        customer_name: input.customerName,
        property_name: input.propertyName,
        job_type: input.jobType,
        dispatch_status: input.dispatchStatus,
        dispatchability: input.dispatchability,
        target_date: input.targetDate ?? null,
        estimated_duration_hours: input.estimatedDurationHours,
        priority: input.priority,
        sequencing_notes: input.sequencingNotes ?? null,
        constraints: input.constraints,
      })
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      )
      .single();

    if (error) throw new Error(error.message);
    return mapDispatchPlan(data as DispatchPlanRow);
  });
}

export async function updateDispatchPlanStatus(id: string, status: DispatchStatus) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_plans")
      .update({ dispatch_status: status, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", id)
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      )
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Dispatch plan ${id} not found.`);
    return mapDispatchPlan(data as DispatchPlanRow);
  });
}

export async function updateDispatchPlanStatusByJobId(jobId: string, status: DispatchStatus, onlyUpToDate?: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();

    const { data, error } = await supabase
      .from("dispatch_plans")
      .update({ dispatch_status: status, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("job_id", jobId).lte("target_date", status === "in_progress" && onlyUpToDate ? onlyUpToDate : "9999-12-31")
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      );

    if (error) throw new Error(error.message);
    return ((data ?? []) as DispatchPlanRow[]).map(mapDispatchPlan);
  });
}

// ---------------------------------------------------------------------------
// CRUD — Crew Assignments
// ---------------------------------------------------------------------------

export async function listCrewAssignments(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("crew_assignments")
      .select(
        "id,org_id,dispatch_plan_id,job_id,crew_id,crew_name,lead_installer,supporting_technicians,status,assigned_at,reassignment_history"
      )
      .eq("org_id", orgId)
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as CrewAssignmentRow[]).map(mapCrewAssignment);
  });
}

export interface CrewAssignmentWriteInput {
  dispatchPlanId: string;
  jobId?: string;
  crewId: string;
  crewName: string;
  leadInstaller: string;
  supportingTechnicians: string[];
  status: AssignmentStatus;
  reassignmentHistory: ReassignmentRecord[];
}

export async function upsertCrewAssignment(input: CrewAssignmentWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();

    // Check for existing assignment for this plan
    const { data: existing } = await supabase
      .from("crew_assignments")
      .select("id")
      .eq("org_id", orgId)
      .eq("dispatch_plan_id", input.dispatchPlanId)
      .maybeSingle();

    const now = new Date().toISOString();
    let result;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("crew_assignments")
        .update({
          crew_id: input.crewId,
          crew_name: input.crewName,
          lead_installer: input.leadInstaller,
          supporting_technicians: input.supportingTechnicians,
          status: input.status,
          assigned_at: now,
          reassignment_history: input.reassignmentHistory,
          updated_at: now,
        })
        .eq("org_id", orgId)
        .eq("id", existing.id)
        .select(
          "id,org_id,dispatch_plan_id,job_id,crew_id,crew_name,lead_installer,supporting_technicians,status,assigned_at,reassignment_history"
        )
        .single();
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await supabase
        .from("crew_assignments")
        .insert({
          org_id: orgId,
          dispatch_plan_id: input.dispatchPlanId,
          job_id: input.jobId ?? null,
          crew_id: input.crewId,
          crew_name: input.crewName,
          lead_installer: input.leadInstaller,
          supporting_technicians: input.supportingTechnicians,
          status: input.status,
          assigned_at: now,
          reassignment_history: input.reassignmentHistory,
        })
        .select(
          "id,org_id,dispatch_plan_id,job_id,crew_id,crew_name,lead_installer,supporting_technicians,status,assigned_at,reassignment_history"
        )
        .single();
      if (error) throw new Error(error.message);
      result = data;
    }

    return mapCrewAssignment(result as CrewAssignmentRow);
  });
}

// ---------------------------------------------------------------------------
// CRUD — Schedule Blocks
// ---------------------------------------------------------------------------

export async function listScheduleBlocks(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("schedule_blocks")
      .select(
        "id,org_id,dispatch_plan_id,job_id,crew_assignment_id,crew_name,scheduled_date,scheduled_start_time,scheduled_end_time,estimated_duration_hours,job_type,customer_name,property_name,dispatch_status"
      )
      .eq("org_id", orgId)
      .order("scheduled_date")
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as ScheduleBlockRow[]).map(mapScheduleBlock);
  });
}

export interface ScheduleBlockWriteInput {
  dispatchPlanId: string;
  jobId?: string;
  crewAssignmentId?: string;
  crewName: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  estimatedDurationHours: number;
  jobType: string;
  customerName: string;
  propertyName: string;
  dispatchStatus: DispatchStatus;
}

export async function upsertScheduleBlock(input: ScheduleBlockWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();

    // Remove any existing block for this plan before inserting new one
    await supabase
      .from("schedule_blocks")
      .delete()
      .eq("org_id", orgId)
      .eq("dispatch_plan_id", input.dispatchPlanId);

    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({
        org_id: orgId,
        dispatch_plan_id: input.dispatchPlanId,
        job_id: input.jobId ?? null,
        crew_assignment_id: input.crewAssignmentId ?? null,
        crew_name: input.crewName,
        scheduled_date: input.scheduledDate,
        scheduled_start_time: input.scheduledStartTime,
        scheduled_end_time: input.scheduledEndTime,
        estimated_duration_hours: input.estimatedDurationHours,
        job_type: input.jobType,
        customer_name: input.customerName,
        property_name: input.propertyName,
        dispatch_status: input.dispatchStatus,
      })
      .select(
        "id,org_id,dispatch_plan_id,job_id,crew_assignment_id,crew_name,scheduled_date,scheduled_start_time,scheduled_end_time,estimated_duration_hours,job_type,customer_name,property_name,dispatch_status"
      )
      .single();

    if (error) throw new Error(error.message);
    return mapScheduleBlock(data as ScheduleBlockRow);
  });
}

// ---------------------------------------------------------------------------
// CRUD — Dispatch Events
// ---------------------------------------------------------------------------

export async function listDispatchEvents(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_events")
      .select("id,org_id,dispatch_plan_id,type,timestamp,description,metadata")
      .eq("org_id", orgId)
      .order("timestamp")
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as DispatchEventRow[]).map(mapDispatchEvent);
  });
}

export interface DispatchEventWriteInput {
  dispatchPlanId: string;
  type: DispatchEventType;
  description: string;
  metadata?: Record<string, string>;
}

export async function appendDispatchEvent(input: DispatchEventWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("dispatch_events")
      .insert({
        org_id: orgId,
        dispatch_plan_id: input.dispatchPlanId,
        type: input.type,
        timestamp: new Date().toISOString(),
        description: input.description,
        metadata: input.metadata ?? null,
      })
      .select("id,org_id,dispatch_plan_id,type,timestamp,description,metadata")
      .single();

    if (error) throw new Error(error.message);
    return mapDispatchEvent(data as DispatchEventRow);
  });
}

// ---------------------------------------------------------------------------
// Bulk snapshot load
// ---------------------------------------------------------------------------

export interface DispatchRepositorySnapshot {
  plans: DispatchPlan[];
  crews: Crew[];
  assignments: CrewAssignment[];
  scheduleBlocks: ScheduleBlock[];
  events: DispatchEvent[];
}

export async function loadDispatchSnapshot(): Promise<DispatchRepositorySnapshot> {
  const { supabase, orgId } = await getRepositoryContext();

  const [plansRes, crewsRes, assignmentsRes, blocksRes, eventsRes] = await Promise.all([
    supabase
      .from("dispatch_plans")
      .select(
        "id,org_id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("crews")
      .select("id,org_id,name,lead_installer,members,certifications,availability,truck_name")
      .eq("org_id", orgId)
      .order("name"),
    supabase
      .from("crew_assignments")
      .select(
        "id,org_id,dispatch_plan_id,job_id,crew_id,crew_name,lead_installer,supporting_technicians,status,assigned_at,reassignment_history"
      )
      .eq("org_id", orgId),
    supabase
      .from("schedule_blocks")
      .select(
        "id,org_id,dispatch_plan_id,job_id,crew_assignment_id,crew_name,scheduled_date,scheduled_start_time,scheduled_end_time,estimated_duration_hours,job_type,customer_name,property_name,dispatch_status"
      )
      .eq("org_id", orgId)
      .order("scheduled_date"),
    supabase
      .from("dispatch_events")
      .select("id,org_id,dispatch_plan_id,type,timestamp,description,metadata")
      .eq("org_id", orgId)
      .order("timestamp"),
  ]);

  if (plansRes.error) throw new Error(plansRes.error.message);
  if (crewsRes.error) throw new Error(crewsRes.error.message);
  if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
  if (blocksRes.error) throw new Error(blocksRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const rawPlans = (plansRes.data ?? []) as DispatchPlanRow[];
  const rawBlocks = (blocksRes.data ?? []) as ScheduleBlockRow[];

  // Enrich plans and blocks with PR3C scheduling data (scheduled_start_at) from jobs.
  // Falls back gracefully if the column is not yet present (migration pending).
  const jobIds = [
    ...new Set([
      ...rawPlans.map((p) => p.job_id).filter((id): id is string => !!id),
      ...rawBlocks.map((b) => b.job_id).filter((id): id is string => !!id),
    ]),
  ];

  const scheduledStartAtByJobId = new Map<string, string>(); const assignedTechNamesByJobId = new Map<string, string[]>();
  const jobTitleByJobId = new Map<string, string>();
  if (jobIds.length > 0) {
    // Try PR3C column first; silently skip on column-missing errors.
    const { data: jobRows, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,scheduled_start_at")
      .in("id", jobIds);

    if (!jobsError) {
      for (const row of jobRows ?? []) {
        const jRow = row as {
          id: string;
          title: string | null;
          scheduled_start_at: string | null;
        };
        if (jRow.scheduled_start_at) {
          scheduledStartAtByJobId.set(jRow.id, jRow.scheduled_start_at);
        }
        if (jRow.title) {
          jobTitleByJobId.set(jRow.id, jRow.title);
        }
      }
    }
    // If the column is missing (pre-migration), we simply leave the maps empty —
    // dispatch cards will render without a scheduled time badge rather than crash.
  }

  if (jobIds.length > 0) { const { data: assigneeRows } = await supabase.from("job_assignees").select("job_id,user_id").eq("org_id", orgId).in("job_id", jobIds).order("created_at", { ascending: true }); const assigneeUserIds = [...new Set((assigneeRows ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean))]; if (assigneeUserIds.length > 0) { const { data: profileRows } = await supabase.from("user_profiles").select("id,full_name,email").in("id", assigneeUserIds); const nameById = new Map<string, string>(); for (const p of profileRows ?? []) { const pr = p as { id: string; full_name: string | null; email: string | null }; nameById.set(pr.id, pr.full_name ?? pr.email ?? ""); } for (const r of assigneeRows ?? []) { const ar = r as { job_id: string; user_id: string }; const nm = nameById.get(ar.user_id); if (!nm) continue; const list = assignedTechNamesByJobId.get(ar.job_id) ?? []; if (!list.includes(nm)) list.push(nm); assignedTechNamesByJobId.set(ar.job_id, list); } } } const plans = rawPlans.map((row) => {
    const plan = mapDispatchPlan(row);
    if (row.job_id) {
      const startAt = scheduledStartAtByJobId.get(row.job_id);
      if (startAt) plan.scheduledStartAt = startAt;
      const jobTitle = jobTitleByJobId.get(row.job_id); const techNames = assignedTechNamesByJobId.get(row.job_id); if (techNames && techNames.length > 0) plan.assignedTechNames = techNames;
      if (jobTitle) plan.jobTitle = jobTitle;
    }
    return plan;
  });

  const scheduleBlocks = rawBlocks.map((row) => {
    const block = mapScheduleBlock(row);
    if (row.job_id) {
      const startAt = scheduledStartAtByJobId.get(row.job_id);
      if (startAt) block.scheduledStartAt = startAt;
    }
    return block;
  });

  return {
    plans,
    crews: ((crewsRes.data ?? []) as CrewRow[]).map(mapCrew),
    assignments: ((assignmentsRes.data ?? []) as CrewAssignmentRow[]).map(mapCrewAssignment),
    scheduleBlocks,
    events: ((eventsRes.data ?? []) as DispatchEventRow[]).map(mapDispatchEvent),
  };
}
