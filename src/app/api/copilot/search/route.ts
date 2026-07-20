import { NextResponse } from "next/server";

import { searchCopilot, type CopilotSearchRequestBody } from "@/features/copilot";
import { requireApiSession } from "@/lib/auth/apiGuard";

export async function POST(request: Request) {
  const sessionResult = await requireApiSession(request);
  if (sessionResult.error) return sessionResult.error;

  let body: CopilotSearchRequestBody;

  try {
    body = (await request.json()) as CopilotSearchRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const query = (body.query ?? "").trim();

  if (!query) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }

  const result = await searchCopilot(query, body.context);
  return NextResponse.json(result);
}
