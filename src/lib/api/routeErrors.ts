import { NextResponse } from "next/server";

export function invalidJsonResponse() {
  return NextResponse.json(
    {
      error: "INVALID_PAYLOAD",
      message: "Request body must be valid JSON.",
      code: 400,
    },
    { status: 400 },
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  return (await request.json()) as Record<string, unknown>;
}

export function mapRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown server error.";

  if (message === "SUPABASE_NOT_CONFIGURED") {
    return NextResponse.json(
      {
        error: "SERVICE_UNAVAILABLE",
        message: "Supabase is not configured for this environment.",
        code: 503,
      },
      { status: 503 },
    );
  }

  if (message === "SUPABASE_SESSION_REQUIRED" || message === "USER_PROFILE_NOT_FOUND") {
    return NextResponse.json(
      {
        error: "UNAUTHORIZED",
        message: "A valid session is required.",
        code: 401,
      },
      { status: 401 },
    );
  }

  if (message.toLowerCase().includes("not found")) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message,
        code: 404,
      },
      { status: 404 },
    );
  }

  if (message.toLowerCase().includes("required") || message.toLowerCase().includes("invalid")) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message,
        code: 400,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message,
      code: 500,
    },
    { status: 500 },
  );
}
