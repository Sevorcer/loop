import "server-only";

import type { CalendarQuickGroup } from "@/features/calendar/utils/calendarPeopleFilter";

import { getRepositoryContext } from "./supabaseContext";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("calendar_saved_groups") ||
    message.includes("calendar_saved_group_members")
  );
}

function unavailableError(): Error {
  return Object.assign(new Error("Shared calendar groups are not ready yet."), {
    status: 503,
    code: "GROUPS_UNAVAILABLE",
  });
}

export async function listCalendarGroups(): Promise<CalendarQuickGroup[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const groups = await supabase
    .from("calendar_saved_groups")
    .select("id,name")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (groups.error) {
    if (unavailable(groups.error)) throw unavailableError();
    throw new Error(groups.error.message);
  }
  const members = await supabase
    .from("calendar_saved_group_members")
    .select("group_id,user_id,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (members.error) {
    if (unavailable(members.error)) throw unavailableError();
    throw new Error(members.error.message);
  }
  const people = new Map<string, string[]>();
  for (const row of (members.data ?? []) as Array<{ group_id: string; user_id: string }>) {
    const list = people.get(row.group_id) ?? [];
    list.push(row.user_id);
    people.set(row.group_id, list);
  }
  return ((groups.data ?? []) as Array<{ id: string; name: string }>)
    .map((group) => ({
      id: group.id,
      name: group.name,
      personIds: people.get(group.id) ?? [],
    }))
    .filter((group) => group.personIds.length > 0);
}

export async function createCalendarGroup(name: string, personIds: string[]): Promise<CalendarQuickGroup> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const people = await assertPeople(supabase, orgId, personIds);
  const inserted = await supabase
    .from("calendar_saved_groups")
    .insert({
      org_id: orgId,
      name: name.trim(),
      created_by: userId,
    })
    .select("id,name")
    .single();
  if (inserted.error || !inserted.data) {
    if (inserted.error && unavailable(inserted.error)) throw unavailableError();
    throw new Error(inserted.error?.message ?? "The group could not be saved.");
  }
  const group = inserted.data as { id: string; name: string };
  const memberError = await replaceMembers(supabase, orgId, group.id, people);
  if (memberError) {
    await supabase.from("calendar_saved_groups").delete().eq("id", group.id).eq("org_id", orgId);
    throw new Error(memberError);
  }
  return { id: group.id, name: group.name, personIds: people };
}

export async function updateCalendarGroup(
  id: string,
  name: string,
  personIds: string[],
): Promise<CalendarQuickGroup> {
  if (!UUID.test(id)) throw new Error("Invalid group.");
  const { supabase, orgId } = await getRepositoryContext();
  const people = await assertPeople(supabase, orgId, personIds);
  const updated = await supabase
    .from("calendar_saved_groups")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id,name")
    .maybeSingle();
  if (updated.error) {
    if (unavailable(updated.error)) throw unavailableError();
    throw new Error(updated.error.message);
  }
  if (!updated.data) throw Object.assign(new Error("That group was not found."), { status: 404 });
  const memberError = await replaceMembers(supabase, orgId, id, people);
  if (memberError) throw new Error(memberError);
  const group = updated.data as { id: string; name: string };
  return { id: group.id, name: group.name, personIds: people };
}

export async function deleteCalendarGroup(id: string): Promise<void> {
  if (!UUID.test(id)) throw new Error("Invalid group.");
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("calendar_saved_groups").delete().eq("id", id).eq("org_id", orgId);
  if (error) {
    if (unavailable(error)) throw unavailableError();
    throw new Error(error.message);
  }
}

type Client = Awaited<ReturnType<typeof getRepositoryContext>>["supabase"];

async function assertPeople(supabase: Client, orgId: string, personIds: string[]): Promise<string[]> {
  const ids = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("Invalid group. Choose at least one person.");
  if (ids.length > 24) throw new Error("Invalid group. Choose 24 people or fewer.");
  if (ids.some((id) => !UUID.test(id))) throw new Error("Invalid person.");
  const { data, error } = await supabase.from("user_profiles").select("id").eq("org_id", orgId).in("id", ids);
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== ids.length) throw new Error("Invalid person. Someone on this group is not in the company.");
  return ids;
}

async function replaceMembers(
  supabase: Client,
  orgId: string,
  groupId: string,
  personIds: string[],
): Promise<string | null> {
  const removed = await supabase
    .from("calendar_saved_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("org_id", orgId);
  if (removed.error) return removed.error.message;
  const inserted = await supabase.from("calendar_saved_group_members").insert(
    personIds.map((userId) => ({
      group_id: groupId,
      org_id: orgId,
      user_id: userId,
    })),
  );
  return inserted.error?.message ?? null;
}
