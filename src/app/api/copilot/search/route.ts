import { NextResponse } from "next/server";

import { searchCopilot, type CopilotSearchRequestBody } from "@/features/copilot";

export async function POST(request: Request) {
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

  const result = searchCopilot(query, body.context);
  return NextResponse.json(result);
}
