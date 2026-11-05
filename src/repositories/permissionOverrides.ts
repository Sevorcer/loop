import "server-only";

import type { CoreTable, TableAction, AppRole } from "@/services/authorization";
import { getRepositoryContext } from "./supabaseContext";
import type { SessionRepositoryContextInput } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoleOverrideRow {
  id: string;
  org_id: string;
  role: string;
  table_name: string;
  action: string;
  allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserOverrideRow {
  id: string;
  org_id: string;
  user_id: string;
  table_name: string;
  action: string;
  allowed: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Role overrides
// ---------------------------------------------------------------------------

export async function listRoleOverrides(
  orgId: string,
  input?: SessionRepositoryContextInput,
): Promise<RoleOverrideRow[]> {
  const { supabase } = await getRepositoryContext(input);
  const { data, error } = await supabase
    .from("permission_role_overrides")
    .select("*")
    .eq("org_id", orgId)
    .order("role")
    .order("table_name")
    .order("action");

  if (error) throw new Error(`Failed to list role overrides: ${error.message}`);
  return (data ?? []) as RoleOverrideRow[];
}

export async function setRoleOverride(
  orgId: string,
  role: AppRole,
  tableName: CoreTable,
  action: TableAction,
  allowed: boolean,
  input?: SessionRepositoryContextInput,
): Promise<RoleOverrideRow> {
  const { supabase } = await getRepositoryContext(input);
  const { data, error } = await supabase
    .from("permission_role_overrides")
    .upsert(
      {
        org_id: orgId,
        role,
        table_name: tableName,
        action,
        allowed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,role,table_name,action" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to set role override: ${error.message}`);
  return data as RoleOverrideRow;
}

export async function deleteRoleOverride(
  orgId: string,
  role: AppRole,
  tableName: CoreTable,
  action: TableAction,
  input?: SessionRepositoryContextInput,
): Promise<void> {
  const { supabase } = await getRepositoryContext(input);
  const { error } = await supabase
    .from("permission_role_overrides")
    .delete()
    .eq("org_id", orgId)
    .eq("role", role)
    .eq("table_name", tableName)
    .eq("action", action);

  if (error) throw new Error(`Failed to delete role override: ${error.message}`);
}

// ---------------------------------------------------------------------------
// User overrides
// ---------------------------------------------------------------------------

export async function listUserOverrides(
  orgId: string,
  userId?: string,
  input?: SessionRepositoryContextInput,
): Promise<UserOverrideRow[]> {
  const { supabase } = await getRepositoryContext(input);
  let query = supabase
    .from("permission_user_overrides")
    .select("*")
    .eq("org_id", orgId);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query
    .order("user_id")
    .order("table_name")
    .order("action");

  if (error) throw new Error(`Failed to list user overrides: ${error.message}`);
  return (data ?? []) as UserOverrideRow[];
}

export async function setUserOverride(
  orgId: string,
  userId: string,
  tableName: CoreTable,
  action: TableAction,
  allowed: boolean,
  input?: SessionRepositoryContextInput,
): Promise<UserOverrideRow> {
  const { supabase } = await getRepositoryContext(input);
  const { data, error } = await supabase
    .from("permission_user_overrides")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        table_name: tableName,
        action,
        allowed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,user_id,table_name,action" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to set user override: ${error.message}`);
  return data as UserOverrideRow;
}

export async function deleteUserOverride(
  orgId: string,
  userId: string,
  tableName: CoreTable,
  action: TableAction,
  input?: SessionRepositoryContextInput,
): Promise<void> {
  const { supabase } = await getRepositoryContext(input);
  const { error } = await supabase
    .from("permission_user_overrides")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("table_name", tableName)
    .eq("action", action);

  if (error) throw new Error(`Failed to delete user override: ${error.message}`);
}
