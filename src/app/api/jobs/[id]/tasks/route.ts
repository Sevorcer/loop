import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  applyInstallChecklistTemplate,
  createJobTask,
  deleteJobTask,
  listJobTasks,
  renameJobTask,
  setJobTaskDone,
} from "@/services/jobTasks";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const tasks = await listJobTasks(id);
    return NextResponse.json({ tasks });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    if (body.template === "install") {
      const tasks = await applyInstallChecklistTemplate(id);
      return NextResponse.json({ tasks });
    }

    const task = await createJobTask(id, String(body.label ?? ""));
    return NextResponse.json({ task });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);
    const taskId = String(body.taskId ?? "").trim();

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required." },
        { status: 400 },
      );
    }

    void id;

    const task =
      typeof body.isDone === "boolean"
        ? await setJobTaskDone(taskId, body.isDone)
        : await renameJobTask(taskId, String(body.label ?? ""));

    return NextResponse.json({ task });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);
    const taskId = String(body.taskId ?? "").trim();

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required." },
        { status: 400 },
      );
    }

    void id;

    await deleteJobTask(taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}
