import { NextResponse } from "next/server";

export interface UnauthorizedBody {
  error: "UNAUTHORIZED";
  message: string;
  code: 401;
}

export function unauthorizedResponse(
  message = "A valid session is required.",
): NextResponse<UnauthorizedBody> {
  return NextResponse.json<UnauthorizedBody>(
    { error: "UNAUTHORIZED", message, code: 401 },
    { status: 401 },
  );
}
