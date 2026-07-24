interface ErrorRecord {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
}

function toErrorRecord(value: unknown): ErrorRecord {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as ErrorRecord;
}

export function getPostRequestTrace(request: Request, fallbackPrefix: string) {
  const correlationId = request.headers.get("x-correlation-id");
  const requestId =
    request.headers.get("x-request-id") ??
    correlationId ??
    request.headers.get("x-vercel-id") ??
    `${fallbackPrefix}-${Date.now()}`;

  return {
    requestId,
    correlationId: correlationId ?? requestId,
  };
}

export function extractSupabaseError(error: unknown) {
  const errorRecord = toErrorRecord(error);

  return {
    code: typeof errorRecord.code === "string" ? errorRecord.code : null,
    message: typeof errorRecord.message === "string" ? errorRecord.message : null,
    details: errorRecord.details ?? null,
    hint: errorRecord.hint ?? null,
    status: typeof errorRecord.status === "number" ? errorRecord.status : null,
  };
}

export function extractSanitizedPostPayload(body: Record<string, unknown>) {
  const orgId = body.org_id ?? body.orgId;
  const customerId = body.customer_id ?? body.customerId;
  const openJobs = body.open_jobs ?? body.openJobs;

  return {
    org_id: typeof orgId === "string" ? orgId : null,
    customer_id: typeof customerId === "string" ? customerId : null,
    type: typeof body.type === "string" ? body.type : null,
    status: typeof body.status === "string" ? body.status : null,
    primary_system:
      typeof body.primary_system === "string"
        ? body.primary_system
        : typeof body.primarySystem === "string"
          ? body.primarySystem
          : null,
    open_jobs: typeof openJobs === "number" ? openJobs : null,
  };
}
