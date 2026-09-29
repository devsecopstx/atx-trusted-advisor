import { ObjectId } from "mongodb";

import type { SessionUser } from "@/lib/auth";
import { signSessionCookieValueForAutomation } from "@/lib/auth";
import { capUserTaskStoredOutput, cleanUserTaskLlmOutput } from "@/lib/clean-user-task-llm-output";
import { getDeskSmtpConfig, sendDeskPlainEmailWithRetry } from "@/lib/desk-smtp";
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
import { getPersonaById, getPersonaByNormalizedName } from "@/modules/xchat/repository";

/**
 * App-user `user_tasks` → internal `POST /api/xchat/ask` (`postXchatAsk`): finance-advisor defaults + fast + reports RAG surface.
 *
 * System `admin_scheduled_tasks` deliberately stay on the direct Spring/Next task-runner path
 * (scanners, digests, etc.) — only `user_tasks` route through finance-advisor xChat.
 *
 * Optional future: if another caller needs the same ask JSON defaults, extract `resolveFinanceAdvisorAskParams()`
 * for shared field construction only — do not merge execution logic with admin schedulers.
 */

export type RunUserTaskResult = {
  status: "success" | "failed" | "skipped";
  outputSnippet: string;
  errorCode?: string;
  linkHint?: string;
};

type EffectiveTaskPersona = {
  personaId: string | null;
  source: "task_override" | "finance_advisor_default" | "finance_advisor_fallback";
  fallbackNotice?: string;
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
    message: params.message,
    financeKbRagSurface: "reports",
    reasoningMode: "fast"
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
    data?: { content?: string; response?: string; logId?: string };
    error?: string;
    code?: string;
  };
  const responseMarkdown =
    typeof json.data?.content === "string"
      ? json.data.content
      : typeof json.data?.response === "string"
        ? json.data.response
        : undefined;
  const responseTextRaw =
    responseMarkdown !== undefined
      ? responseMarkdown
      : typeof json.error === "string"
        ? json.error
        : res.statusText;
  const responseText =
    res.ok && responseMarkdown !== undefined
      ? capUserTaskStoredOutput(cleanUserTaskLlmOutput(responseMarkdown))
      : responseTextRaw.trim();
  const snippet = responseText.length > 0 ? responseText : "(empty)";
  return {
    ok: res.ok,
    status: res.status,
    snippet,
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
    console.warn("[user_tasks/email] skip: user has no email", { taskId: task._id?.toHexString() });
    return;
  }
  if (!getDeskSmtpConfig()) {
    console.warn(
      "[user_tasks/email] skip: Gmail SMTP not configured (set SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM)"
    );
    return;
  }
  const sent = await sendDeskPlainEmailWithRetry(email, subject, body);
  if (!sent) {
    console.warn("[user_tasks/email] send failed after retries", {
      taskId: task._id?.toHexString(),
      to: email.replace(/(^.).*(@.*)$/, "$1***$2")
    });
  }
}

async function resolveEffectiveTaskPersona(task: UserTask): Promise<EffectiveTaskPersona> {
  const financeAdvisorPersona = await getPersonaByNormalizedName("finance-advisor");
  const financeAdvisorPersonaId = financeAdvisorPersona?._id?.toHexString() ?? null;
  const advisorPersona = await getPersonaByNormalizedName("advisor");
  const advisorPersonaId = advisorPersona?._id?.toHexString() ?? null;

  const requestedPersonaId = task.personaId?.trim() || null;
  if (!requestedPersonaId) {
    if (financeAdvisorPersonaId) {
      return {
        personaId: financeAdvisorPersonaId,
        source: "finance_advisor_default"
      };
    }
    if (advisorPersonaId) {
      return {
        personaId: advisorPersonaId,
        source: "finance_advisor_fallback",
        fallbackNotice: "finance-advisor persona is not available in this workspace; running with advisor."
      };
    }
    return {
      personaId: null,
      source: "finance_advisor_fallback",
      fallbackNotice: "No task default persona (finance-advisor or advisor) found in the database."
    };
  }

  const requestedPersona = await getPersonaById(requestedPersonaId);
  if (requestedPersona?.status === "published") {
    return {
      personaId: requestedPersonaId,
      source: "task_override"
    };
  }

  if (financeAdvisorPersonaId) {
    return {
      personaId: financeAdvisorPersonaId,
      source: "finance_advisor_fallback",
      fallbackNotice: "Your selected persona is no longer available. Running this job with finance-advisor."
    };
  }

  if (advisorPersonaId) {
    return {
      personaId: advisorPersonaId,
      source: "finance_advisor_fallback",
      fallbackNotice:
        "Your selected persona is no longer available; finance-advisor is missing — running with advisor."
    };
  }

  return {
    personaId: null,
    source: "finance_advisor_fallback",
    fallbackNotice:
      "Your selected persona is no longer available, and neither finance-advisor nor advisor was found."
  };
}

async function auditTaskExecution(params: {
  task: UserTask;
  session: SessionUser;
  triggeredBy: string;
  status: RunUserTaskResult["status"];
  askStatus?: number;
  outputSnippet: string;
  errorCode?: string;
  personaSelectionSource: EffectiveTaskPersona["source"];
  effectivePersonaId: string | null;
  fallbackNotice?: string;
}): Promise<void> {
  await createAuditEvent({
    entityType: "user_task",
    entityId: params.task._id!.toHexString(),
    action: "user_task_run",
    actor: {
      userId: params.session.userId,
      email: params.session.email,
      username: params.session.username
    },
    details: {
      triggeredBy: params.triggeredBy,
      taskName: params.task.name,
      status: params.status,
      askStatus: params.askStatus,
      errorCode: params.errorCode,
      personaSelectionSource: params.personaSelectionSource,
      effectivePersonaId: params.effectivePersonaId,
      fallbackNotice: params.fallbackNotice,
      outputSnippet:
        params.outputSnippet.length > 4000
          ? `${params.outputSnippet.slice(0, 4000)}…`
          : params.outputSnippet
    }
  });
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

  const effectivePersona = await resolveEffectiveTaskPersona(task);

  if (task.type === "strategy" || task.type === "scan" || task.type === "report") {
    const result: RunUserTaskResult = {
      status: "skipped",
      outputSnippet:
        "This task type is not automated yet. Use xOptions or ask xChat interactively for strategy scans.",
      errorCode: "type_not_automated"
    };
    await auditTaskExecution({
      task,
      session,
      triggeredBy,
      status: result.status,
      outputSnippet: result.outputSnippet,
      errorCode: result.errorCode,
      personaSelectionSource: effectivePersona.source,
      effectivePersonaId: effectivePersona.personaId,
      fallbackNotice: effectivePersona.fallbackNotice
    });
    return result;
  }

  const portfolioHex = task.portfolioId ? task.portfolioId.toHexString() : undefined;
  const scope = task.params?.scope ?? "all";
  let prompt = task.prompt.trim();
  if (scope === "watchlist") {
    prompt = `${prompt}\n\n(Context: focus on my watchlist symbols when relevant.)`;
  } else if (scope === "portfolio" && portfolioHex) {
    prompt = `${prompt}\n\n(Context: use workspace portfolio ${portfolioHex}.)`;
  }
  prompt = `${prompt}\n\n---\n**Automation delivery:** This reply is stored as the task result (and may be emailed). Output **only** polished Markdown. **Do not** emit \`XF_CITE:*\` chips, XML tool residue, or fenced raw JSON tool dumps — translate tool results into plain-English numbers and bullets.`;

  const ask = await postXchatAsk({
    session,
    message: prompt,
    portfolioIdHex: portfolioHex,
    personaId: effectivePersona.personaId,
    request
  });

  const linkHint =
    ask.logId && ask.ok ? `/xchat?highlightLog=${encodeURIComponent(ask.logId)}` : "/xchat";

  if (!ask.ok) {
    const result: RunUserTaskResult = {
      status: "failed",
      outputSnippet: effectivePersona.fallbackNotice ? `${effectivePersona.fallbackNotice}\n\n${ask.snippet}` : ask.snippet,
      errorCode: ask.code ?? `http_${ask.status}`,
      linkHint
    };
    await auditTaskExecution({
      task,
      session,
      triggeredBy,
      status: result.status,
      askStatus: ask.status,
      outputSnippet: result.outputSnippet,
      errorCode: result.errorCode,
      personaSelectionSource: effectivePersona.source,
      effectivePersonaId: effectivePersona.personaId,
      fallbackNotice: effectivePersona.fallbackNotice
    });
    return result;
  }

  const outputSnippet = effectivePersona.fallbackNotice
    ? `${effectivePersona.fallbackNotice}\n\n${ask.snippet}`
    : ask.snippet;

  if (params.sendEmail !== false && task.delivery.includes("email")) {
    await deliverEmailIfNeeded(
      task,
      `aTx Finance — task: ${task.name}`,
      `${outputSnippet}\n\nOpen xChat: ${resolveAutomationOrigin(request)}/xchat`
    );
  }

  const result: RunUserTaskResult = {
    status: "success",
    outputSnippet,
    linkHint
  };
  await auditTaskExecution({
    task,
    session,
    triggeredBy,
    status: result.status,
    askStatus: ask.status,
    outputSnippet: result.outputSnippet,
    personaSelectionSource: effectivePersona.source,
    effectivePersonaId: effectivePersona.personaId,
    fallbackNotice: effectivePersona.fallbackNotice
  });
  return result;
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
