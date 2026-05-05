import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { listUserTaskRunsForTask } from "@/modules/user-tasks/repository";
import { serializeUserTaskRun } from "@/modules/user-tasks/serialize";

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { taskId } = await context.params;
  if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session scope" }, { status: 400 });
  }
  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? rawLimit : 25;

  const rows = await listUserTaskRunsForTask({
    tenantId: new ObjectId(session.tenantId),
    userId: new ObjectId(session.userId),
    taskId,
    limit
  });

  return NextResponse.json({ data: rows.map(serializeUserTaskRun) });
}
