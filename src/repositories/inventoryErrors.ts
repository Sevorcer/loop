import "server-only";

/**
 * Translates Postgres errors from the inventory tables into errors carrying an
 * HTTP `status`, which `mapRouteError` already understands.
 */

interface DbError {
  code?: string;
  message: string;
}

export function throwInventoryDbError(error: DbError, conflictMessage = "That already exists."): never {
  if (error.code === "23505") {
    throw Object.assign(new Error(conflictMessage), { status: 409 });
  }
  if (error.code === "23503") {
    throw Object.assign(new Error("A referenced record does not exist or is still in use."), { status: 409 });
  }
  if (error.code === "23514" || error.code === "P0001") {
    // CHECK violation or a raise from a ledger guard trigger: the message is safe and specific.
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  if (error.code === "42501") {
    throw Object.assign(new Error("You do not have permission to do that."), { status: 403 });
  }
  throw new Error(error.message);
}

/** Strips characters that would break a PostgREST `.or()` filter or act as LIKE wildcards. */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%*\\_]/g, " ").trim().slice(0, 80);
}
