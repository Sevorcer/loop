export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

type RequestJsonOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  role?: string | null;
};

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
    throw new ApiRequestError(
      (data as { message?: string; error?: string } | null)?.message ??
        (data as { message?: string; error?: string } | null)?.error ??
        "Request failed.",
      response.status,
    );
  }

  return data as T;
}