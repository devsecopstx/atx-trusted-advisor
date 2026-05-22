import { ObjectId } from "mongodb";

import { ADVISOR_AI_DISCLOSURE_VERSION } from "@/lib/advisor-disclosures";
import { getDb } from "@/lib/mongodb";
import { adminGetPortfolioById } from "@/modules/core-admin/repository";
import { isAdvisorPlatformRole, isGlobalAdmin } from "@/modules/identity/authorization";
import { getCoreUserById, normalizeMongoUserIdHex } from "@/modules/identity/repository";

const COLLECTION = "advisor_advice_events" as const;

const MAX_CONTENT_CHARS = 512_000;

let indexesEnsured = false;

export const advisorAdviceSurfaceValues = [
  "xchat",
  "xoptions_quant_trader",
  "xoptions_review",
  "xoptions_wheel",
  "portfolio_alert_narrative",
  "portfolio_desk_wellness",
  "portfolio_watchlist",
  "watchlist_scanner",
  "options_scanner",
  "options_scan_report",
  "portfolio_alert"
] as const;

export type AdvisorAdviceSurface = (typeof advisorAdviceSurfaceValues)[number];

export const advisorAdviceArtifactKindValues = [
  "chat_turn",
  "simulation_report",
  "order_review",
  "wheel_report",
  "options_scan_report",
  "market_quote",
  "watchlist_desk",
  "monte_carlo_report",
  "desk_report",
  "alert_narrative",
  "desk_wellness_brief",
  "watchlist_rationale",
  "scanner_rationale",
  "portfolio_alert",
  "recommendation_note"
] as const;

export type AdvisorAdviceArtifactKind = (typeof advisorAdviceArtifactKindValues)[number];

export type AdvisorAdviceEvent = {
  _id?: ObjectId;
  tenantId: ObjectId;
  advisorUserId: ObjectId;
  surface: AdvisorAdviceSurface;
  artifactKind: AdvisorAdviceArtifactKind;
  /** User prompt or request summary (xChat message, simulation params summary, etc.). */
  prompt?: string | null;
  /** Primary human-readable advice body (markdown or plain text). */
  responseText?: string | null;
  /** Structured system output when text alone is insufficient (review payload, MC JSON, etc.). */
  responsePayload?: Record<string, unknown> | null;
  threadId?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  xchatLogId?: ObjectId | null;
  personaId?: ObjectId | null;
  personaName?: string | null;
  model?: string | null;
  disclosureVersion: string;
  contentTruncated?: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

export type PersistAdvisorAdviceEventInput = Omit<AdvisorAdviceEvent, "_id" | "createdAt">;

/** Advisor-role app users only; global_admin and operator/viewer are excluded. */
export function shouldPersistAdvisorAdviceArchive(roles: string[]): boolean {
  if (isGlobalAdmin(roles)) {
    return false;
  }
  return isAdvisorPlatformRole(roles);
}

const NON_ADVICE_RESPONSE_PREFIXES = [
  "I could not ",
  "Options scan failed",
  "Understood, staying in chat",
  "I can show that watchlist once I know which portfolio",
  "No default watchlist is available yet"
] as const;

export function isSubstantiveAdvisorAdviceResponse(response: string): boolean {
  const trimmed = response.trim();
  if (!trimmed) {
    return false;
  }
  return !NON_ADVICE_RESPONSE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function truncateForStorage(value: string, maxChars: number): { text: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return {
    text: value.slice(0, maxChars),
    truncated: true
  };
}

function normalizeOptionalObjectId(value: string | ObjectId | null | undefined): ObjectId | null {
  if (value instanceof ObjectId) {
    return value;
  }
  if (typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return null;
}

export async function ensureAdvisorAdviceEventIndexes(): Promise<void> {
  if (indexesEnsured) {
    return;
  }
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { tenantId: 1, advisorUserId: 1, createdAt: -1 },
    { name: "idx_advisor_advice_tenant_user_created" }
  );
  await col.createIndex(
    { tenantId: 1, surface: 1, createdAt: -1 },
    { name: "idx_advisor_advice_tenant_surface_created" }
  );
  await col.createIndex(
    { advisorUserId: 1, threadId: 1, createdAt: -1 },
    {
      name: "idx_advisor_advice_user_thread_created",
      partialFilterExpression: { threadId: { $type: "string" } }
    }
  );
  indexesEnsured = true;
}

export async function persistAdvisorAdviceEvent(
  input: PersistAdvisorAdviceEventInput
): Promise<ObjectId | null> {
  if (!ObjectId.isValid(input.tenantId) || !ObjectId.isValid(input.advisorUserId)) {
    return null;
  }

  await ensureAdvisorAdviceEventIndexes();

  let responseText = input.responseText ?? null;
  let contentTruncated = input.contentTruncated === true;
  if (typeof responseText === "string" && responseText.length > MAX_CONTENT_CHARS) {
    const trimmed = truncateForStorage(responseText, MAX_CONTENT_CHARS);
    responseText = trimmed.text;
    contentTruncated = true;
  }

  let prompt = input.prompt ?? null;
  if (typeof prompt === "string" && prompt.length > 32_000) {
    const trimmed = truncateForStorage(prompt, 32_000);
    prompt = trimmed.text;
    contentTruncated = contentTruncated || trimmed.truncated;
  }

  const db = await getDb();
  const result = await db.collection<AdvisorAdviceEvent>(COLLECTION).insertOne({
    tenantId: input.tenantId,
    advisorUserId: input.advisorUserId,
    surface: input.surface,
    artifactKind: input.artifactKind,
    prompt,
    responseText,
    responsePayload: input.responsePayload ?? null,
    threadId: input.threadId ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    xchatLogId: input.xchatLogId ?? null,
    personaId: input.personaId ?? null,
    personaName: input.personaName ?? null,
    model: input.model ?? null,
    disclosureVersion: input.disclosureVersion?.trim() || ADVISOR_AI_DISCLOSURE_VERSION,
    contentTruncated: contentTruncated || undefined,
    metadata: input.metadata ?? null,
    createdAt: new Date()
  });
  return result.insertedId;
}

export function fireAndForgetPersistAdvisorAdviceEvent(
  input: PersistAdvisorAdviceEventInput
): void {
  void persistAdvisorAdviceEvent(input).catch((err: unknown) => {
    console.error("[compliance/advisor-advice] persist failed", {
      surface: input.surface,
      artifactKind: input.artifactKind,
      error: err instanceof Error ? err.message : String(err)
    });
  });
}

export type ArchiveAdvisorXchatTurnInput = {
  roles: string[];
  tenantId: string | ObjectId | null | undefined;
  userId: string | ObjectId;
  prompt: string;
  response: string;
  artifactKind?: AdvisorAdviceArtifactKind;
  threadId?: string;
  requestId?: string;
  correlationId?: string;
  logId?: string | ObjectId | null;
  personaId?: string | ObjectId | null;
  personaName?: string | null;
  model?: string | null;
  scope?: string;
  metadata?: Record<string, unknown>;
};

/** Compliance copy for advisor xChat turns (independent of opt-in `xchat_logs`). */
export function archiveAdvisorXchatTurnIfRequired(input: ArchiveAdvisorXchatTurnInput): void {
  if (!shouldPersistAdvisorAdviceArchive(input.roles)) {
    return;
  }
  const tenantId = normalizeOptionalObjectId(input.tenantId);
  const advisorUserId = normalizeOptionalObjectId(input.userId);
  if (!tenantId || !advisorUserId) {
    return;
  }
  const response = input.response.trim();
  if (!isSubstantiveAdvisorAdviceResponse(response)) {
    return;
  }

  fireAndForgetPersistAdvisorAdviceEvent({
    tenantId,
    advisorUserId,
    surface: "xchat",
    artifactKind: input.artifactKind ?? "chat_turn",
    prompt: input.prompt.trim() || null,
    responseText: response,
    threadId: input.threadId?.trim() || null,
    requestId: input.requestId?.trim() || null,
    correlationId: input.correlationId?.trim() || null,
    xchatLogId: normalizeOptionalObjectId(input.logId),
    personaId: normalizeOptionalObjectId(input.personaId),
    personaName: input.personaName ?? null,
    model: input.model ?? null,
    disclosureVersion: ADVISOR_AI_DISCLOSURE_VERSION,
    metadata: {
      scope: input.scope ?? null,
      ...(input.metadata ?? {})
    }
  });
}

export type ArchiveAdvisorSystemAdviceInput = {
  roles?: string[];
  tenantId: string | ObjectId | null | undefined;
  userId: string | ObjectId;
  surface: AdvisorAdviceSurface;
  artifactKind: AdvisorAdviceArtifactKind;
  prompt?: string | null;
  responseText?: string | null;
  responsePayload?: Record<string, unknown> | null;
  threadId?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  logId?: string | ObjectId | null;
  personaId?: string | ObjectId | null;
  personaName?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
};

const advisorRolesCache = new Map<string, { roles: string[]; loadedAt: number }>();
const ROLES_CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadAdvisorRolesForUserId(userIdHex: string): Promise<string[]> {
  if (!ObjectId.isValid(userIdHex)) {
    return [];
  }
  const cached = advisorRolesCache.get(userIdHex);
  if (cached && Date.now() - cached.loadedAt < ROLES_CACHE_TTL_MS) {
    return cached.roles;
  }
  const user = await getCoreUserById(new ObjectId(userIdHex));
  const roles = user?.roles ?? [];
  advisorRolesCache.set(userIdHex, { roles, loadedAt: Date.now() });
  return roles;
}

/** Async advisor archive for scheduled jobs and routes without session roles in memory. */
export function fireAndForgetArchiveAdvisorSystemAdvice(input: ArchiveAdvisorSystemAdviceInput): void {
  void (async () => {
    const userIdHex =
      input.userId instanceof ObjectId ? input.userId.toHexString() : String(input.userId);
    const roles = input.roles ?? (await loadAdvisorRolesForUserId(userIdHex));
    if (!shouldPersistAdvisorAdviceArchive(roles)) {
      return;
    }
    const tenantId = normalizeOptionalObjectId(input.tenantId);
    const advisorUserId = normalizeOptionalObjectId(userIdHex);
    if (!tenantId || !advisorUserId) {
      return;
    }
    const responseText = input.responseText?.trim() || null;
    const hasPayload =
      input.responsePayload != null && Object.keys(input.responsePayload).length > 0;
    if (
      responseText &&
      !isSubstantiveAdvisorAdviceResponse(responseText) &&
      !hasPayload
    ) {
      return;
    }
    if (!responseText && !hasPayload) {
      return;
    }

    await persistAdvisorAdviceEvent({
      tenantId,
      advisorUserId,
      surface: input.surface,
      artifactKind: input.artifactKind,
      prompt: input.prompt?.trim() || null,
      responseText,
      responsePayload: input.responsePayload ?? null,
      threadId: input.threadId ?? null,
      requestId: input.requestId ?? null,
      correlationId: input.correlationId ?? null,
      xchatLogId: normalizeOptionalObjectId(input.logId),
      personaId: normalizeOptionalObjectId(input.personaId),
      personaName: input.personaName ?? null,
      model: input.model ?? null,
      disclosureVersion: ADVISOR_AI_DISCLOSURE_VERSION,
      metadata: input.metadata ?? null
    });
  })().catch((err: unknown) => {
    console.error("[compliance/advisor-advice] system archive failed", {
      surface: input.surface,
      artifactKind: input.artifactKind,
      error: err instanceof Error ? err.message : String(err)
    });
  });
}

export type ArchiveAdvisorXoptionsPayloadInput = Omit<
  ArchiveAdvisorSystemAdviceInput,
  "surface"
> & {
  surface: Exclude<AdvisorAdviceSurface, "xchat">;
};

export function archiveAdvisorXoptionsAdviceIfRequired(input: ArchiveAdvisorXoptionsPayloadInput): void {
  fireAndForgetArchiveAdvisorSystemAdvice(input);
}

export async function resolvePortfolioOwnerForAdviceArchive(
  portfolioIdHex: string
): Promise<{ userId: string; tenantId: string | null } | null> {
  const portfolio = await adminGetPortfolioById(portfolioIdHex);
  if (!portfolio?._id) {
    return null;
  }
  const userId = normalizeMongoUserIdHex(portfolio.userId);
  if (!userId) {
    return null;
  }
  return {
    userId,
    tenantId: portfolio.tenantId?.toHexString() ?? null
  };
}

export async function countAdvisorAdviceEventsForAdvisor(input: {
  tenantId: string;
  advisorUserId: string;
}): Promise<number> {
  if (!ObjectId.isValid(input.tenantId) || !ObjectId.isValid(input.advisorUserId)) {
    return 0;
  }
  await ensureAdvisorAdviceEventIndexes();
  const db = await getDb();
  return db.collection(COLLECTION).countDocuments({
    tenantId: new ObjectId(input.tenantId),
    advisorUserId: new ObjectId(input.advisorUserId)
  });
}
