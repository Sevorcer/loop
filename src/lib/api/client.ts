import { beginClientAuthRecovery } from "@/lib/auth/clientRecovery";
import type { AuthErrorReason, UnauthorizedReason } from "@/lib/auth/errorContract";

export class ApiRequestError extends Error {
  status: number;
  reason?: AuthErrorReason;
  code?: string;

  constructor(message: string, status: number, options?: { reason?: AuthErrorReason; code?: string }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.reason = options?.reason;
    this.code = options?.code;
  }
}

type RequestJsonOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  role?: string | null;
};

function parseApiErrorPayload(
  value: unknown,
): { message?: string; error?: string; reason?: AuthErrorReason } | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as Record<string, unknown>;
  return {
    message: typeof payload.message === "string" ? payload.message : undefined,
    error: typeof payload.error === "string" ? payload.error : undefined,
    reason: typeof payload.reason === "string" ? (payload.reason as AuthErrorReason) : undefined,
  };
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  options: RequestJsonOptions = {},
): Promise<T> {
  const { body, headers, role, ...rest } = options;

  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  // Keep temporary non-prod compatibility path used by current API auth fallback.
  if (role && process.env.NODE_ENV !== "production") {
    requestHeaders.set("x-loop-role", role);
  }

  const response = await fetch(input, {
    credentials: "include",
    ...rest,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorPayload = parseApiErrorPayload(data);

    if (response.status === 401) {
      beginClientAuthRecovery((errorPayload?.reason as UnauthorizedReason | undefined) ?? "missing_token");
    }

    throw new ApiRequestError(
      errorPayload?.message ??
        errorPayload?.error ??
        "Request failed.",
      response.status,
      {
        reason: errorPayload?.reason,
        code: errorPayload?.error,
      },
    );
  }

  return data as T;
}