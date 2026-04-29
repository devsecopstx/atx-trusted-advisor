import { ObjectId } from "mongodb";

import type { SessionUser } from "@/lib/auth";
import { signSessionCookieValueForAutomation } from "@/lib/auth";
import { sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
import { computeNextRunAtFromSchedule } from "@/lib/scheduled-task-schedule";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";
import { createAuditEvent } from "@/modules/audit/repository";
import { getCoreUserById } from "@/modules/identity/repository";
import {
    claimDueUserTaskForExecution,
    finalizeUserTaskRun,
    getUserTaskById,
    getUserTaskByIdInternal,
    insertUserTaskRun,
    updateUserTaskAfterRun
} from "@/modules/user-tasks/repository";
import { resolveSessionUserForUserTask } from "@/modules/user-tasks/resolve-session-for-task";
import type { UserTask } from "@/modules/user-tasks/types";

export type RunUserTaskResult = {
  status: "success" | "failed" | "skipped";
  outputSnippet: string;
  errorCode?: string;
  linkHint?: string;
};

function resolveAutomationOrigin(request?: Request): string {
  if (request) {
    const u = new URL(request.url);
    return `${u.protocol}//${u.host}`;
  }
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const v = process.env.VERCEL_URL?.trim();
  if (v) {
    return `https://${v}`;
  }
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

function cookieHeaderForAutomation(session: SessionUser, request?: Request): string {
  const fromRequest = request?.headers.get("cookie");
  if (fromRequest?.includes(`${SESSION_COOKIE_NAME}=`)) {
    return fromRequest;
  }
  const signed = signSessionCookieValueForAutomation(session);
  return `${SESSION_COOKIE_NAME}=${signed}`;
}

async function postXchatAsk(params: {
  session: SessionUser;
  message: string;
  portfolioIdHex?: string | null;
  personaId?: string | null;
  request?: Request;
}): Promise<{ ok: boolean; status: number; snippet: string; logId?: string; code?: string }> {
  const origin = resolveAutomationOrigin(params.request);
  const url = `${origin}/api/xchat/ask`;
  const body: Record<string, unknown> = {
    message: params.message
  };
  if (params.portfolioIdHex && /^[a-f\d]{24}$/i.test(params.portfolioIdHex)) {
    body.portfolioId = params.portfolioIdHex;
  }
  if (params.personaId?.trim()) {
    body.personaId = params.personaId.trim();
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeaderForAutomation(params.session, params.request)
    },
    body: JSON.stringify(body)
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { response?: string; logId?: string };
    error?: string;
    code?: string;
  };
  const responseText =
    typeof json.data?.response === "string" ? json.data.response : typeof json.error === "string"
      ? json.error
      : res.statusText;
  const snippet = responseText.trim().slice(0, 480);
  return {
    ok: res.ok,
    status: res.status,
    snippet: snippet.length > 0 ? snippet : "(empty)",
    logId: typeof json.data?.logId === "string" ? json.data.logId : undefined,
    code: typeof json.code === "string" ? json.code : undefined
  };
}

async function deliverEmailIfNeeded(task: UserTask, subject: string, body: string): Promise<void> {
  if (!task.delivery.includes("email")) {
    return;
  }
  const user = await getCoreUserById(task.userId);
  const email = user?.email?.trim();
  if (!email) {
    return;
  }
  await sendDeskPlainEmailWithRetry(email, subject, body);
}

export async function executeUserTaskBody(params: {
  task: UserTask;
  triggeredBy: string;
  request?: Request;
  /** When false, skip sending email (dedupe with in-app only). */
  sendEmail?: boolean;
}): Promise<RunUserTaskResult> {
  const { task, triggeredBy, request } = params;
  const session = await resolveSessionUserForUserTask(task);
  if (!session) {
    return {
      status: "failed",
      outputSnippet: "Could not resolve user session for automation.",
      errorCode: "session_unresolved"
    };
  }

  if (task.type === "strategy" || task.type === "scan" || task.type === "report") {
    return {
      status: "skipped",
      outputSnippet:
        "This task type is not automated yet. Use xOptions or ask xChat interactively for strategy scans.",
      errorCode: "type_not_automated"
    };
  }

  const portfolioHex = task.portfolioId ? task.portfolioId.toHexString() : undefined;
  const scope = task.params?.scope ?? "all";
  let prompt = task.prompt.trim();
  if (scope === "watchlist") {
    prompt = `${prompt}\n\n(Context: focus on my watchlist symbols when relevant.)`;
  } else if (scope === "portfolio" && portfolioHex) {
    prompt = `${prompt}\n\n(Context: use workspace portfolio ${portfolioHex}.)`;
  }

  const ask = await postXchatAsk({
    session,
    message: prompt,
    portfolioIdHex: portfolioHex,
    personaId: task.personaId,
    request
  });

  const linkHint =
    ask.logId && ask.ok ? `/xchat?highlightLog=${encodeURIComponent(ask.logId)}` : "/xchat";

  if (!ask.ok) {
    return {
      status: "failed",
      outputSnippet: ask.snippet,
      errorCode: ask.code ?? `http_${ask.status}`,
      linkHint
    };
  }

  if (params.sendEmail !== false && task.delivery.includes("email")) {
    await deliverEmailIfNeeded(
      task,
      `aTx Finance — task: ${task.name}`,
      `${ask.snippet}\n\nOpen xChat: ${resolveAutomationOrigin(request)}/xchat`
    );
  }

  await createAuditEvent({
    entityType: "user_task",
    entityId: task._id!.toHexString(),
    action: "user_task_run",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      triggeredBy,
      taskName: task.name,
      status: "success",
      askStatus: ask.status
    }
  });

  return {
    status: "success",
    outputSnippet: ask.snippet,
    linkHint
  };
}

export async function runUserTaskNow(params: {
  taskId: string;
  tenantId: ObjectId;
  userId: ObjectId;
  triggeredBy: string;
  request?: Request;
}): Promise<{ runId: ObjectId; result: RunUserTaskResult } | { error: string; code: string }> {
  const task = await getUserTaskById({
    taskId: params.taskId,
    tenantId: params.tenantId,
    userId: params.userId
  });
  if (!task?._id) {
    return { error: "Task not found", code: "not_found" };
  }

  const startedAt = new Date();
  const runDoc = await insertUserTaskRun({
    tenantId: task.tenantId,
    userId: task.userId,
    taskId: task._id,
    status: "running",
    triggeredBy: params.triggeredBy,
    startedAt
  });
  if (!runDoc._id) {
    return { error: "Run failed to persist", code: "persist_error" };
  }

  const result = await executeUserTaskBody({
    task,
    triggeredBy: params.triggeredBy,
    request: params.request,
    sendEmail: true
  });

  const completedAt = new Date();
  const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());

  await finalizeUserTaskRun(runDoc._id, {
    status: result.status === "success" ? "success" : result.status === "skipped" ? "skipped" : "failed",
    outputSnippet: result.outputSnippet,
    errorCode: result.errorCode,
    completedAt,
    durationMs,
    linkHint: result.linkHint
  });

  const nextRunAt =
    computeNextRunAtFromSchedule(
      { scheduleCron: task.scheduleCron, scheduleRRule: task.scheduleRRule },
      startedAt
    ) ?? new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);

  await updateUserTaskAfterRun({
    taskId: task._id,
    tenantId: task.tenantId,
    userId: task.userId,
    lastRunAt: startedAt,
    nextRunAt,
    lastResultSnippet: result.outputSnippet,
    lastRunId: runDoc._id
  });

  return { runId: runDoc._id, result };
}

export async function processDueUserTaskById(params: {
  taskId: ObjectId;
  now: Date;
  triggeredBy: string;
}): Promise<{ ok: boolean; message: string }> {
  const claimed = await claimDueUserTaskForExecution({ taskId: params.taskId, now: params.now });
  if (!claimed?._id) {
    return { ok: false, message: "not_due_or_claim_failed" };
  }
  const task = await getUserTaskByIdInternal(claimed._id.toHexString());
  if (!task?._id) {
    return { ok: false, message: "task_missing" };
  }

  const startedAt = new Date();
  const runDoc = await insertUserTaskRun({
    tenantId: task.tenantId,
    userId: task.userId,
    taskId: task._id,
    status: "running",
    triggeredBy: params.triggeredBy,
    startedAt
  });
  if (!runDoc._id) {
    return { ok: false, message: "run_insert_failed" };
  }

  const result = await executeUserTaskBody({
    task,
    triggeredBy: params.triggeredBy,
    sendEmail: true
  });

  const completedAt = new Date();
  const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());
  await finalizeUserTaskRun(runDoc._id, {
    status: result.status === "success" ? "success" : result.status === "skipped" ? "skipped" : "failed",
    outputSnippet: result.outputSnippet,
    errorCode: result.errorCode,
    completedAt,
    durationMs,
    linkHint: result.linkHint
  });

  await updateUserTaskAfterRun({
    taskId: task._id,
    tenantId: task.tenantId,
    userId: task.userId,
    lastRunAt: startedAt,
    nextRunAt: claimed.nextRunAt ?? null,
    lastResultSnippet: result.outputSnippet,
    lastRunId: runDoc._id
  });

  return { ok: true, message: result.outputSnippet.slice(0, 120) };
}
