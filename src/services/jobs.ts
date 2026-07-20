import "server-only";

import type { Job, JobStatus } from "@/features/jobs/types/job";
import type { JobActivity } from "@/features/jobs/types/jobActivity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type JobRow = {
  id: string;
  job_number: string;
  estimate_id: string | null;
  equipment_bundle_id: string | null;
  title: string;
  type: Job["type"];
  status: Job["status"];
  priority: Job["priority"];
  customer_name: string;
  property_name: string;
  assigned_to: string;
  scheduled_for: string | null;
  summary: string;
  location: string;
  notes: string;
  created_at: string;
};

type JobActivityRow = {
  id: string;
  job_id: string;
  type: JobActivity["type"];
  title: string;
  description: string;
  created_at: string;
};

export interface CreateJobInput {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  type: Job["type"];
  priority: Job["priority"];
  customerName: string;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  summary: string;
  location: string;
  notes: string;
}

export type UpdateJobInput = Partial<CreateJobInput> & {
  status?: JobStatus;
};

const DEV_ORG_ID = process.env.LOOP_DEV_ORG_ID ?? null;

async function resolveOrgId() {
  if (DEV_ORG_ID) {
    return DEV_ORG_ID;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Unable to resolve organization id.");
  }

  return data.id as string;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    estimateId: row.estimate_id ?? undefined,
    equipmentBundleId: row.equipment_bundle_id ?? undefined,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority,
    customerName: row.customer_name,
    propertyName: row.property_name,
    assignedTo: row.assigned_to,
    scheduledFor: row.scheduled_for ?? row.created_at.slice(0, 10),
    summary: row.summary,
    location: row.location,
    notes: row.notes,
  };
}

function toJobActivity(row: JobActivityRow): JobActivity {
  return {
    id: row.id,
    jobId: row.job_id,
    type: row.type,
    title: row.title,
    description: row.description,
    timestamp: row.created_at,
  };
}

export async function listJobs(): Promise<Job[]> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_name,property_name,assigned_to,scheduled_for,summary,location,notes,created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toJob(row as JobRow));
}

export async function getJob(id: string): Promise<Job | null> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_name,property_name,assigned_to,scheduled_for,summary,location,notes,created_at"
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toJob(data as JobRow) : null;
}

export async function listJobActivity(jobId: string): Promise<JobActivity[]> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toJobActivity(row as JobActivityRow));
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from("jobs")
    .select("id", { head: true, count: "exact" })
    .eq("org_id", orgId);

  if (countError) {
    throw new Error(countError.message);
  }

  const jobNumber = `JOB-${1000 + (count ?? 0) + 1}`;

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      org_id: orgId,
      job_number: jobNumber,
      estimate_id: input.estimateId || null,
      equipment_bundle_id: input.equipmentBundleId || null,
      title: input.title,
      type: input.type,
      status: "Scheduled",
      priority: input.priority,
      customer_name: input.customerName,
      property_name: input.propertyName,
      assigned_to: input.assignedTo,
      scheduled_for: input.scheduledFor,
      summary: input.summary,
      location: input.location,
      notes: input.notes,
    })
    .select(
      "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_name,property_name,assigned_to,scheduled_for,summary,location,notes,created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create job.");
  }

  await createJobActivity(data.id as string, {
    type: "created",
    title: "Job created",
    description: `New ${input.type.toLowerCase()} job created from the job form.`,
  });

  await createJobActivity(data.id as string, {
    type: "assigned",
    title: "Technician assigned",
    description: `${input.assignedTo} assigned to this job.`,
  });

  await createJobActivity(data.id as string, {
    type: "scheduled",
    title: "Schedule confirmed",
    description: `Job scheduled for ${new Date(input.scheduledFor).toLocaleDateString()}.`,
  });

  return toJob(data as JobRow);
}

export async function updateJob(
  id: string,
  input: UpdateJobInput
): Promise<Job | null> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.estimateId !== undefined) patch.estimate_id = input.estimateId || null;
  if (input.equipmentBundleId !== undefined) {
    patch.equipment_bundle_id = input.equipmentBundleId || null;
  }
  if (input.title !== undefined) patch.title = input.title;
  if (input.type !== undefined) patch.type = input.type;
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.customerName !== undefined) patch.customer_name = input.customerName;
  if (input.propertyName !== undefined) patch.property_name = input.propertyName;
  if (input.assignedTo !== undefined) patch.assigned_to = input.assignedTo;
  if (input.scheduledFor !== undefined) patch.scheduled_for = input.scheduledFor;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.location !== undefined) patch.location = input.location;
  if (input.notes !== undefined) patch.notes = input.notes;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(
      "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_name,property_name,assigned_to,scheduled_for,summary,location,notes,created_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toJob(data as JobRow) : null;
}

export async function deleteJob(id: string): Promise<boolean> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("jobs")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function createJobActivity(
  jobId: string,
  activity: Pick<JobActivity, "type" | "title" | "description">
) {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("job_activity").insert({
    org_id: orgId,
    job_id: jobId,
    type: activity.type,
    title: activity.title,
    description: activity.description,
  });

  if (error) {
    throw new Error(error.message);
  }
}
