import "server-only";

import type { CalendarPerson, CalendarTaskEntry, TimeOffEntry } from "@/features/calendar/types/calendarEntries";

import { getRepositoryContext } from "./supabaseContext";

interface TimeOffRow {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  reason: string;
  note: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  assign_everyone: boolean;
  job_id: string | null;
  customer_id: string | null;
  done_at: string | null;
}

interface AssigneeRow {
  task_id: string;
  user_id: string;
}

const TIME_OFF_COLUMNS = "id,user_id,starts_at,ends_at,all_day,reason,note";
const TASK_COLUMNS =
  "id,title,description,starts_at,ends_at,all_day,assign_everyone,job_id,customer_id,done_at";

export async function listTimeOff(): Promise<TimeOffEntry[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("time_off")
    .select(TIME_OFF_COLUMNS)
    .eq("org_id", orgId)
    .order("starts_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TimeOffRow[];
  const names = await profileNames(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    personName: names.get(row.user_id) ?? "Team member",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    reason: row.reason,
    note: row.note ?? "",
  }));
}

export async function insertTimeOff(input: {
  userId: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string;
  note: string;
}): Promise<void> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const { error } = await supabase.from("time_off").insert({
    org_id: orgId,
    user_id: input.userId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    all_day: input.allDay,
    reason: input.reason.trim(),
    note: input.note.trim(),
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function updateTimeOff(
  id: string,
  input: {
    userId: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    reason: string;
    note: string;
  },
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("time_off")
    .update({
      user_id: input.userId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      all_day: input.allDay,
      reason: input.reason.trim(),
      note: input.note.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTimeOff(id: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("time_off").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCalendarTasks(): Promise<CalendarTaskEntry[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("calendar_tasks")
    .select(TASK_COLUMNS)
    .eq("org_id", orgId)
    .order("starts_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TaskRow[];
  const taskIds = rows.map((row) => row.id);
  const assignees = await taskAssignees(taskIds);
  const profileIds = assignees.map((row) => row.user_id);
  const names = await profileNames(profileIds);
  const jobNumbers = await jobNumbersById(rows.map((row) => row.job_id).filter((id): id is string => Boolean(id)));
  const customerNames = await customerNamesById(
    rows.map((row) => row.customer_id).filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => {
    const people = assignees.filter((assignee) => assignee.task_id === row.id);
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allDay: row.all_day,
      assignEveryone: row.assign_everyone,
      assigneeIds: people.map((person) => person.user_id),
      assigneeNames: people.map((person) => names.get(person.user_id) ?? "Team member"),
      jobId: row.job_id,
      jobNumber: row.job_id ? jobNumbers.get(row.job_id) ?? null : null,
      customerId: row.customer_id,
      customerName: row.customer_id ? customerNames.get(row.customer_id) ?? null : null,
      doneAt: row.done_at,
    };
  });
}

export async function insertCalendarTask(input: {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  assignEveryone: boolean;
  assigneeIds: string[];
  jobId: string | null;
  customerId: string | null;
  doneAt?: string | null;
}): Promise<string> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("calendar_tasks")
    .insert({
      org_id: orgId,
      title: input.title.trim(),
      description: input.description.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      all_day: input.allDay,
      assign_everyone: input.assignEveryone,
      job_id: input.jobId,
      customer_id: input.customerId,
      done_at: input.doneAt ?? null,
      done_by: input.doneAt ? userId : null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;
  await replaceAssignees(id, input.assignEveryone ? [] : input.assigneeIds);
  return id;
}

export async function updateCalendarTask(
  id: string,
  input: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    assignEveryone: boolean;
    assigneeIds: string[];
    jobId: string | null;
    customerId: string | null;
    doneAt: string | null;
  },
): Promise<void> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const { error } = await supabase
    .from("calendar_tasks")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      all_day: input.allDay,
      assign_everyone: input.assignEveryone,
      job_id: input.jobId,
      customer_id: input.customerId,
      done_at: input.doneAt,
      done_by: input.doneAt ? userId : null,
    })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  await replaceAssignees(id, input.assignEveryone ? [] : input.assigneeIds);
}

export async function setCalendarTaskDone(id: string, done: boolean): Promise<void> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const { error } = await supabase
    .from("calendar_tasks")
    .update({
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? userId : null,
    })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCalendarTask(id: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("calendar_tasks").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCalendarTeam(): Promise<CalendarPerson[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,full_name,email,app_role")
    .eq("org_id", orgId)
    .in("app_role", ["owner", "manager", "dispatch", "tech", "office", "sales"]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
    .map((row) => ({
      id: row.id,
      name: (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findJobIdByNumber(jobNumber: string): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("job_number", jobNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function findCustomerIdByName(name: string): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name")
    .eq("org_id", orgId)
    .ilike("name", escapeIlike(name));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  const exact = rows.filter((row) => row.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (exact.length > 1) {
    throw new Error("Invalid customer name. More than one customer matches.");
  }
  return exact[0]?.id ?? null;
}

async function replaceAssignees(taskId: string, userIds: string[]): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error: deleteError } = await supabase
    .from("calendar_task_assignees")
    .delete()
    .eq("org_id", orgId)
    .eq("task_id", taskId);
  if (deleteError) throw new Error(deleteError.message);
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return;
  const { error } = await supabase.from("calendar_task_assignees").insert(
    unique.map((userId) => ({ org_id: orgId, task_id: taskId, user_id: userId })),
  );
  if (error) throw new Error(error.message);
}

async function taskAssignees(taskIds: string[]): Promise<AssigneeRow[]> {
  if (taskIds.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("calendar_task_assignees")
    .select("task_id,user_id")
    .eq("org_id", orgId)
    .in("task_id", taskIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as AssigneeRow[];
}

async function profileNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return names;
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.from("user_profiles").select("id,full_name,email").in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    names.set(row.id, (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member");
  }
  return names;
}

async function jobNumbersById(ids: string[]): Promise<Map<string, string>> {
  const numbers = new Map<string, string>();
  if (ids.length === 0) return numbers;
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select("id,job_number")
    .eq("org_id", orgId)
    .in("id", Array.from(new Set(ids)));
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ id: string; job_number: string }>) {
    numbers.set(row.id, row.job_number);
  }
  return numbers;
}

async function customerNamesById(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name")
    .eq("org_id", orgId)
    .in("id", Array.from(new Set(ids)));
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    names.set(row.id, row.name);
  }
  return names;
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}
