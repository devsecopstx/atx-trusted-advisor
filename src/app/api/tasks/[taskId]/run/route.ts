import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { runUserTaskNow } from "@/modules/user-tasks/run-user-task";

export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { taskId } = await context.params;
  if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session scope" }, { status: 400 });
  }

  const result = await runUserTaskNow({
    taskId,
    tenantId: new ObjectId(session.tenantId),
    userId: new ObjectId(session.userId),
    triggeredBy: `app_user:${session.username}`,
    request
  });

  if ("error" in result) {
    const status = result.code === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    data: {
      runId: result.runId.toHexString(),
      status: result.result.status,
      snippet: result.result.outputSnippet,
      linkHint: result.result.linkHint,
      errorCode: result.result.errorCode
    }
  });
}
