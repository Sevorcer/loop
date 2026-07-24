/**
 * src/lib/driftParser.ts
 *
 * Pure utility functions for parsing database schema artefacts out of SQL
 * migration file content.  All functions are side-effect-free and testable
 * without a live database connection.
 *
 * Used by scripts/verify-policies.sh (conceptually) and by unit tests to
 * validate the parsing logic used in drift-detection checks.
 */

// ── Policy parsing ────────────────────────────────────────────────────────────

/**
 * Extract every policy name from a block of SQL text.
 *
 * Handles both quoted and unquoted policy names, e.g.:
 *   CREATE POLICY "my policy name" ON public.table ...
 *   CREATE POLICY my_policy_name ON table_name ...
 *   CREATE POLICY IF NOT EXISTS "foo" ON ...   (unlikely but safe)
 */
export function parsePolicyNames(sql: string): string[] {
  const results: string[] = [];

  // Match CREATE POLICY followed by an optional quoted or unquoted name.
  // Quoted names are delimited by double-quotes and may contain spaces.
  // Unquoted names are word characters only.
  const quotedPattern = /CREATE\s+POLICY\s+"([^"]+)"/gi;
  const unquotedPattern = /CREATE\s+POLICY\s+(?!")(\w+)/gi;

  let match: RegExpExecArray | null;

  match = quotedPattern.exec(sql);
  while (match !== null) {
    results.push(match[1]);
    match = quotedPattern.exec(sql);
  }

  match = unquotedPattern.exec(sql);
  while (match !== null) {
    results.push(match[1]);
    match = unquotedPattern.exec(sql);
  }

  return Array.from(new Set(results)).sort();
}

// ── Table parsing ─────────────────────────────────────────────────────────────

/**
 * Extract table names from CREATE TABLE / CREATE TABLE IF NOT EXISTS statements.
 *
 * Returns unqualified table names (strips schema prefix if present).
 */
export function parseTableNames(sql: string): string[] {
  const results: string[] = [];
  const pattern =
    /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"?(?:\w+)"?\.)?"?(\w+)"?/gi;

  let match: RegExpExecArray | null;
  match = pattern.exec(sql);
  while (match !== null) {
    results.push(match[1]);
    match = pattern.exec(sql);
  }

  return Array.from(new Set(results)).sort();
}

// ── RLS-enabled table parsing ─────────────────────────────────────────────────

/**
 * Extract table names that have ENABLE ROW LEVEL SECURITY applied in the SQL.
 *
 * Matches both:
 *   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
 */
export function parseRlsEnabledTables(sql: string): string[] {
  const results: string[] = [];
  const pattern =
    /ALTER\s+TABLE\s+(?:"?(?:\w+)"?\.)?"?(\w+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

  let match: RegExpExecArray | null;
  match = pattern.exec(sql);
  while (match !== null) {
    results.push(match[1]);
    match = pattern.exec(sql);
  }

  return Array.from(new Set(results)).sort();
}

// ── Helper function parsing ───────────────────────────────────────────────────

/**
 * Extract function names from CREATE [OR REPLACE] FUNCTION statements.
 *
 * Returns unqualified function names (strips schema prefix if present).
 */
export function parseHelperFunctions(sql: string): string[] {
  const results: string[] = [];
  const pattern =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"?(?:\w+)"?\.)?"?(\w+)"?\s*\(/gi;

  let match: RegExpExecArray | null;
  match = pattern.exec(sql);
  while (match !== null) {
    results.push(match[1]);
    match = pattern.exec(sql);
  }

  return Array.from(new Set(results)).sort();
}

// ── Drift summary ─────────────────────────────────────────────────────────────

export interface DriftCategory {
  /** Items expected (from migrations) but not found in the live database. */
  missing: string[];
  /** Items found in the live database but not expected. */
  unexpected: string[];
}

/**
 * Compute the symmetric difference between expected and actual sets.
 * Returns missing items (in expected but not actual) and unexpected items
 * (in actual but not expected).
 */
export function computeDrift(
  expected: string[],
  actual: string[]
): DriftCategory {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  return {
    missing: expected.filter((item) => !actualSet.has(item)),
    unexpected: actual.filter((item) => !expectedSet.has(item)),
  };
}

// ── JSON summary helpers ──────────────────────────────────────────────────────

export interface DriftReport {
  timestamp: string;
  category: string;
  totalExpected: number;
  totalActual: number;
  missing: string[];
  unexpected: string[];
  status: "ok" | "drift";
}

/**
 * Build a structured drift report suitable for machine-readable output.
 */
export function buildDriftReport(
  category: string,
  expected: string[],
  actual: string[]
): DriftReport {
  const drift = computeDrift(expected, actual);
  return {
    timestamp: new Date().toISOString(),
    category,
    totalExpected: expected.length,
    totalActual: actual.length,
    missing: drift.missing,
    unexpected: drift.unexpected,
    status: drift.missing.length === 0 && drift.unexpected.length === 0 ? "ok" : "drift",
  };
}
