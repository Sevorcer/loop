import type { AppRole } from "@/services/authorization";

interface RequestJsonOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: HeadersInit;
  role?: AppRole | null;
}

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  options: RequestJsonOptions = {},
): Promise<T> {
  const { body, headers, role, ...init } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  if (role) {
    requestHeaders.set("x-loop-role", role);
  }

  const response = await fetch(input, {
    ...init,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.message ?? payload?.error ?? "Request failed.",
      response.status,
    );
  }

  return payload as T;
}
