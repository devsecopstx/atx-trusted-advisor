import { ObjectId, type Filter } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { parseTenantObjectId } from "@/lib/mongo-tenant-scope";
import {
    computeNextRunAtFromSchedule,
    resolveScheduleDescription
} from "@/lib/scheduled-task-schedule";
import {
    createScheduledTask,
    listTaskRuns
} from "@/modules/core-admin/repository";
import type { ScheduledTask, TaskRun } from "@/modules/core-admin/types";
import {
    type MarketingPostHistoryRow,
    type MarketingPostTemplate,
    type MarketingTaskConfig
} from "@/modules/marketing/types";

const MARKETING_TEMPLATES_COLLECTION = "marketing_post_templates";
const SCHEDULED_TASKS_COLLECTION = "admin_scheduled_tasks";

function marketingScheduleIdFilter(taskId: string): Filter<ScheduledTask> | null {
  if (!ObjectId.isValid(taskId)) {
    return null;
  }
  return {
    _id: new ObjectId(taskId),
    category: "marketing_post",
    $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
  };
}

const DEFAULT_MARKETING_TEMPLATES: Array<
  Omit<MarketingPostTemplate, "_id" | "createdAt" | "updatedAt">
> = [
  {
    slug: "monday-market-pulse",
    name: "Monday Market Pulse",
    platforms: ["x", "linkedin"],
    contentTemplate:
      "Monday Market Pulse ({date}): defined-risk setups > random swing trades. Use aTx Advisor scanners to shortlist covered calls, protective puts, and wheel entries in minutes.",
    defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" },
    disclaimerMode: "required",
    estimatedEngagement: "high"
  },
  {
    slug: "tuesday-deep-education",
    name: "Tuesday Deep Education",
    platforms: ["x", "linkedin"],
    contentTemplate:
      "Tuesday Deep Education: {market_pulse}. Break one options concept into a practical desk checklist and apply it with xChat + xOptions.",
    defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" },
    disclaimerMode: "required",
    estimatedEngagement: "medium"
  },
  {
    slug: "wednesday-demo",
    name: "Wednesday Demo",
    platforms: ["x", "linkedin"],
    contentTemplate:
      "Wednesday Demo: from portfolio context -> xChat rationale -> trade setup in one workspace. No tab chaos, no fluff, just defined-risk options workflow.",
    defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" },
    disclaimerMode: "required",
    estimatedEngagement: "high"
  },
  {
    slug: "thursday-risk-playbook",
    name: "Thursday Risk Playbook",
    platforms: ["x", "linkedin"],
    contentTemplate:
      "Thursday Risk Playbook: {day_name} means managing downside first. Stress test positions and roll/hedge before volatility forces your hand.",
    defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" },
    disclaimerMode: "required",
    estimatedEngagement: "medium"
  },
  {
    slug: "friday-recap",
    name: "Friday Recap",
    platforms: ["x", "linkedin"],
    contentTemplate:
      "Friday Recap ({date}): what worked, what did not, and what to improve next week for steady options income with defined risk.",
    defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" },
    disclaimerMode: "required",
    estimatedEngagement: "medium"
  }
];

function toHistoryRow(run: TaskRun): MarketingPostHistoryRow {
  return {
    taskRunId: run._id?.toHexString() ?? "",
    taskId: run.taskId.toHexString(),
    taskName: run.taskName,
    status: run.status,
    triggeredBy: run.triggeredBy,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    durationMs: run.durationMs,
    output: run.output
  };
}

function slugifyTemplateName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : "template";
}

export async function ensureMarketingTemplatesSeeded(): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const collection = db.collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION);
  for (const template of DEFAULT_MARKETING_TEMPLATES) {
    await collection.updateOne(
      { slug: template.slug },
      {
        $setOnInsert: {
          ...template,
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    );
  }
}

export async function createMarketingTemplate(input: {
  name: string;
  platforms: MarketingPostTemplate["platforms"];
  contentTemplate: string;
  defaultUtm: MarketingPostTemplate["defaultUtm"];
  estimatedEngagement?: MarketingPostTemplate["estimatedEngagement"];
}): Promise<MarketingPostTemplate> {
  await ensureMarketingTemplatesSeeded();
  const db = await getDb();
  const collection = db.collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION);
  const baseSlug = slugifyTemplateName(input.name);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 24; attempt++) {
    const exists = await collection.findOne({ slug });
    if (!exists) {
      break;
    }
    slug = `${baseSlug}-${attempt + 2}`;
  }
  const now = new Date();
  const doc: Omit<MarketingPostTemplate, "_id"> = {
    slug,
    name: input.name.trim(),
    platforms: input.platforms,
    contentTemplate: input.contentTemplate.trim(),
    defaultUtm: input.defaultUtm,
    disclaimerMode: "required",
    estimatedEngagement: input.estimatedEngagement,
    createdAt: now,
    updatedAt: now
  };
  const result = await collection.insertOne(doc as MarketingPostTemplate);
  return { ...doc, _id: result.insertedId };
}

export async function listMarketingTemplates(): Promise<MarketingPostTemplate[]> {
  await ensureMarketingTemplatesSeeded();
  const db = await getDb();
  return db
    .collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION)
    .find({})
    .sort({ name: 1 })
    .toArray();
}

export async function getMarketingTemplateById(id: string): Promise<MarketingPostTemplate | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  await ensureMarketingTemplatesSeeded();
  const db = await getDb();
  return db
    .collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION)
    .findOne({ _id: new ObjectId(id) });
}

export async function updateMarketingTemplate(
  id: string,
  patch: {
    name?: string;
    platforms?: MarketingPostTemplate["platforms"];
    contentTemplate?: string;
    defaultUtm?: MarketingPostTemplate["defaultUtm"];
    estimatedEngagement?: MarketingPostTemplate["estimatedEngagement"] | null;
  }
): Promise<MarketingPostTemplate | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  await ensureMarketingTemplatesSeeded();
  const db = await getDb();
  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date()
  };
  if (patch.name !== undefined) {
    updateDoc.name = patch.name;
  }
  if (patch.platforms !== undefined) {
    updateDoc.platforms = patch.platforms;
  }
  if (patch.contentTemplate !== undefined) {
    updateDoc.contentTemplate = patch.contentTemplate;
  }
  if (patch.defaultUtm !== undefined) {
    updateDoc.defaultUtm = patch.defaultUtm;
  }
  if (patch.estimatedEngagement !== undefined) {
    updateDoc.estimatedEngagement = patch.estimatedEngagement ?? undefined;
  }
  await db.collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: updateDoc }
  );
  return db
    .collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION)
    .findOne({ _id: new ObjectId(id) });
}

export async function deleteMarketingTemplate(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) {
    return false;
  }
  await ensureMarketingTemplatesSeeded();
  const db = await getDb();
  const result = await db
    .collection<MarketingPostTemplate>(MARKETING_TEMPLATES_COLLECTION)
    .deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/**
 * All marketing schedules (system-wide and per-tenant). Bypass the singleton
 * system-wide list path so Admin → Marketing can show many posts.
 */
export async function listMarketingSchedules(): Promise<ScheduledTask[]> {
  const db = await getDb();
  return db
    .collection<ScheduledTask>(SCHEDULED_TASKS_COLLECTION)
    .find({
      category: "marketing_post",
      $or: [{ portfolioId: { $exists: false } }, { portfolioId: null }]
    } as Filter<ScheduledTask>)
    .sort({ name: 1 })
    .limit(500)
    .toArray();
}

export async function createMarketingSchedule(input: {
  name: string;
  enabled: boolean;
  /** When true (default), omit tenantId. Marketing posts still run once (no per-tenant X fan-out). */
  systemWide?: boolean;
  tenantId?: string;
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
  config: MarketingTaskConfig;
}): Promise<ScheduledTask> {
  const systemWide = input.systemWide !== false;
  const tenantId = systemWide ? undefined : input.tenantId?.trim();
  if (!systemWide && !tenantId) {
    throw new Error("tenantId is required when systemWide is false");
  }
  return createScheduledTask({
    name: input.name,
    category: "marketing_post",
    enabled: input.enabled,
    tenantId,
    scheduleCron: input.scheduleCron,
    scheduleRRule: input.scheduleRRule,
    scheduleDescription: input.scheduleDescription,
    config: input.config
  });
}

export async function updateMarketingSchedule(
  taskId: string,
  patch: {
    name?: string;
    enabled?: boolean;
    systemWide?: boolean;
    tenantId?: string;
    scheduleCron?: string;
    scheduleRRule?: string | null;
    scheduleDescription?: string;
    config?: MarketingTaskConfig;
    nextRunAt?: Date | null;
  }
): Promise<ScheduledTask | null> {
  const existing = await getMarketingScheduleById(taskId);
  if (!existing?._id) {
    return null;
  }
  const filter = marketingScheduleIdFilter(taskId);
  if (!filter) {
    return null;
  }

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, unknown> = {};

  if (patch.systemWide !== undefined || patch.tenantId !== undefined) {
    const nextSystemWide =
      patch.systemWide !== undefined ? patch.systemWide : !existing.tenantId;
    const nextTenantHex = nextSystemWide
      ? undefined
      : (patch.tenantId?.trim() || existing.tenantId?.toHexString());
    if (!nextSystemWide && !nextTenantHex) {
      throw new Error("tenantId is required when systemWide is false");
    }
    if (nextSystemWide) {
      $unset.tenantId = "";
    } else {
      const tenantOid = parseTenantObjectId(nextTenantHex);
      if (!tenantOid) {
        throw new Error("Invalid tenantId");
      }
      $set.tenantId = tenantOid;
    }
  }

  if (patch.name !== undefined) {
    $set.name = patch.name.trim().slice(0, 200);
  }
  if (patch.enabled !== undefined) {
    $set.enabled = patch.enabled;
  }
  const nextScheduleCron =
    patch.scheduleCron !== undefined ? patch.scheduleCron.trim() : existing.scheduleCron;
  const nextScheduleRRule =
    patch.scheduleRRule !== undefined
      ? patch.scheduleRRule === null
        ? undefined
        : patch.scheduleRRule.trim()
      : existing.scheduleRRule;
  if (patch.scheduleCron !== undefined) {
    $set.scheduleCron = nextScheduleCron;
  }
  if (patch.scheduleRRule !== undefined) {
    if (patch.scheduleRRule === null) {
      $unset.scheduleRRule = "";
    } else {
      $set.scheduleRRule = nextScheduleRRule;
    }
  }
  if (patch.scheduleDescription !== undefined) {
    $set.scheduleDescription = patch.scheduleDescription.trim().slice(0, 280);
  } else if (patch.scheduleCron !== undefined || patch.scheduleRRule !== undefined) {
    $set.scheduleDescription = resolveScheduleDescription({
      scheduleCron: nextScheduleCron,
      scheduleRRule: nextScheduleRRule
    });
  }

  const scheduleChanged =
    patch.scheduleCron !== undefined || patch.scheduleRRule !== undefined;
  if (patch.nextRunAt !== undefined) {
    $set.nextRunAt =
      patch.nextRunAt ??
      computeNextRunAtFromSchedule(
        { scheduleCron: nextScheduleCron, scheduleRRule: nextScheduleRRule },
        new Date()
      ) ??
      null;
  } else if (scheduleChanged) {
    $set.nextRunAt =
      computeNextRunAtFromSchedule(
        { scheduleCron: nextScheduleCron, scheduleRRule: nextScheduleRRule },
        new Date()
      ) ?? null;
  }
  if (patch.config !== undefined) {
    $set.config = patch.config;
  }

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return existing;
  }

  const updateDoc: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) {
    updateDoc.$set = $set;
  }
  if (Object.keys($unset).length > 0) {
    updateDoc.$unset = $unset;
  }

  const db = await getDb();
  await db.collection<ScheduledTask>(SCHEDULED_TASKS_COLLECTION).updateOne(filter, updateDoc);
  return getMarketingScheduleById(taskId);
}

/** Admin marketing lookup — not limited to the session tenant (cross-tenant schedule edit). */
export async function getMarketingScheduleById(taskId: string): Promise<ScheduledTask | null> {
  const filter = marketingScheduleIdFilter(taskId);
  if (!filter) {
    return null;
  }
  const db = await getDb();
  return db.collection<ScheduledTask>(SCHEDULED_TASKS_COLLECTION).findOne(filter);
}

export async function listMarketingHistory(tenantIdHex: string, limit = 200): Promise<MarketingPostHistoryRow[]> {
  const runs = await listTaskRuns({ tenantId: tenantIdHex, allTenants: true, limit });
  return runs
    .filter((run) => run.category === "marketing_post")
    .map(toHistoryRow);
}

export async function deleteMarketingSchedule(taskId: string): Promise<boolean> {
  const filter = marketingScheduleIdFilter(taskId);
  if (!filter) {
    return false;
  }
  const db = await getDb();
  const res = await db.collection<ScheduledTask>(SCHEDULED_TASKS_COLLECTION).deleteOne(filter);
  return (res.deletedCount ?? 0) === 1;
}
