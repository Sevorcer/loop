import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

import type { ExistingLoopCustomer } from "../../src/lib/sf-import/linkCustomers";
import type { LoopProfile } from "../../src/lib/sf-import/techs";

const PAGE = 1000;

export interface ImportDatabase {
  kind: "postgres" | "service-role";
  close(): Promise<void>;
  listOrganizations(): Promise<{ id: string }[]>;
  loadProfiles(orgId: string): Promise<LoopProfile[]>;
  loadExistingNames(orgId: string): Promise<string[]>;
  loadCustomers(orgId: string): Promise<ExistingLoopCustomer[] | null>;
  loadKeys(spec: KeySpec, orgId: string): Promise<Set<string> | null>;
  applyBatch(orgId: string, table: string, rows: unknown[]): Promise<void>;
}

export interface KeySpec {
  sql: string;
  supabase: (client: SupabaseClient, orgId: string) => Promise<string[]>;
}

export async function openDatabase(): Promise<ImportDatabase> {
  const connectionString =
    process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.LOOP_DB_URL
    || process.env.SUPABASE_DATABASE_URL
    || "";
  if (connectionString) return openPostgres(connectionString);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (url && key) return openServiceRole(url, key);

  throw new Error(
    "Set DATABASE_URL (a Postgres connection string) or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

export function databaseAvailable(): boolean {
  return Boolean(
    process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.LOOP_DB_URL
    || process.env.SUPABASE_DATABASE_URL
    || ((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

function openPostgres(connectionString: string): ImportDatabase {
  const client = new pg.Client({ connectionString, application_name: "loop-sf-import" });
  let opened = false;
  const ready = async () => {
    if (!opened) {
      await client.connect();
      opened = true;
    }
  };
  return {
    kind: "postgres",
    async close() {
      if (opened) await client.end();
    },
    async listOrganizations() {
      await ready();
      const result = await client.query<{ id: string }>(
        "select id::text as id from public.organizations where deleted_at is null order by created_at",
      );
      return result.rows;
    },
    async loadProfiles(orgId) {
      await ready();
      const result = await client.query<{ id: string; full_name: string | null }>(
        "select id::text as id, full_name from public.user_profiles where org_id = $1",
        [orgId],
      );
      return result.rows.map((row) => ({ id: row.id, fullName: row.full_name ?? "" }));
    },
    async loadExistingNames(orgId) {
      await ready();
      try {
        const result = await client.query<{ name: string }>(
          "select name from public.customers where org_id = $1 and sf_id is null",
          [orgId],
        );
        return result.rows.map((row) => row.name);
      } catch (error) {
        if (isMissingColumn(error)) return [];
        throw error;
      }
    },
    async loadCustomers(orgId) {
      await ready();
      try {
        const result = await client.query<{ id: string; sf_id: string | null }>(
          "select id::text as id, sf_id::text as sf_id from public.customers where org_id = $1",
          [orgId],
        );
        return result.rows.map((row) => ({
          id: row.id,
          sfId: row.sf_id == null ? null : Number(row.sf_id),
        }));
      } catch (error) {
        if (isMissingColumn(error)) return null;
        throw error;
      }
    },
    async loadKeys(spec, orgId) {
      await ready();
      try {
        const result = await client.query<{ key: string }>(spec.sql, [orgId]);
        return new Set(result.rows.map((row) => row.key).filter(Boolean));
      } catch (error) {
        if (isMissingColumn(error) || isMissingRelation(error)) return null;
        throw error;
      }
    },
    async applyBatch(orgId, table, rows) {
      await ready();
      await client.query("BEGIN");
      try {
        await client.query("select public.sf_import_apply_batch($1::jsonb)", [
          JSON.stringify({ org_id: orgId, table, rows }),
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  };
}

function openServiceRole(url: string, key: string): ImportDatabase {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    kind: "service-role",
    async close() {},
    async listOrganizations() {
      const rows = await page(client, "organizations", "id", (query) =>
        query.is("deleted_at", null).order("created_at"),
      );
      return rows.map((row) => ({ id: String(row.id) }));
    },
    async loadProfiles(orgId) {
      const rows = await page(client, "user_profiles", "id,full_name", (query) =>
        query.eq("org_id", orgId),
      );
      return rows.map((row) => ({
        id: String(row.id),
        fullName: typeof row.full_name === "string" ? row.full_name : "",
      }));
    },
    async loadExistingNames(orgId) {
      try {
        const rows = await page(client, "customers", "name", (query) =>
          query.eq("org_id", orgId).is("sf_id", null),
        );
        return rows.map((row) => (typeof row.name === "string" ? row.name : ""));
      } catch (error) {
        if (isMissingColumn(error)) return [];
        throw error;
      }
    },
    async loadCustomers(orgId) {
      try {
        const rows = await page(client, "customers", "id,sf_id", (query) => query.eq("org_id", orgId));
        return rows.map((row) => ({
          id: String(row.id),
          sfId: row.sf_id == null ? null : Number(row.sf_id),
        }));
      } catch (error) {
        if (isMissingColumn(error)) return null;
        throw error;
      }
    },
    async loadKeys(spec, orgId) {
      try {
        const keys = await spec.supabase(client, orgId);
        return new Set(keys.filter(Boolean));
      } catch (error) {
        if (isMissingColumn(error) || isMissingRelation(error)) return null;
        throw error;
      }
    },
    async applyBatch(orgId, table, rows) {
      const { error } = await client.rpc("sf_import_apply_batch", {
        payload: { org_id: orgId, table, rows },
      });
      if (error) throw error;
    },
  };
}

interface PageQuery {
  eq(column: string, value: string): PageQuery;
  is(column: string, value: null): PageQuery;
  order(column: string): PageQuery;
  range(from: number, to: number): PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}

function pageQuery(client: SupabaseClient, table: string, columns: string): PageQuery {
  return client.from(table).select(columns) as unknown as PageQuery;
}

async function page(
  client: SupabaseClient,
  table: string,
  columns: string,
  filter: (query: PageQuery) => PageQuery,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await filter(pageQuery(client, table, columns)).range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? data as Record<string, unknown>[] : [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

export function isMissingColumn(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error);
  return code === "42703" || /column .* does not exist/i.test(message);
}

export function isMissingRelation(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error);
  return code === "42P01" || /relation .* does not exist/i.test(message);
}

export function isMissingFunction(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error);
  return code === "42883" || /sf_import_apply_batch/i.test(message) && /does not exist/i.test(message);
}

export function safeDbMessage(error: unknown): string {
  const cut = errorMessage(error).split("Failing row")[0] ?? "";
  return cut
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "database error";
  }
  return "database error";
}

export function textKey(sql: string, load: KeySpec["supabase"]): KeySpec {
  return { sql, supabase: load };
}
