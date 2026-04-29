import { type Filter, ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { computeNextRunAtFromSchedule } from "@/lib/scheduled-task-schedule";
import type { UserTask, UserTaskRun } from "@/modules/user-tasks/types";

const COLLECTION = "user_tasks";
const RUNS_COLLECTION = "user_task_runs";

let indexesEnsured = false;

async function ensureUserTaskIndexes(): Promise<void> {
  if (indexesEnsured) {
    return;
  }
  const db = await getDb();
  await db.collection(COLLECTION).createIndex({ tenantId: 1, userId: 1, updatedAt: -1 });
  await db.collection(COLLECTION).createIndex({ enabled: 1, nextRunAt: 1 });
  await db.collection(RUNS_COLLECTION).createIndex({ tenantId: 1, userId: 1, startedAt: -1 });
  await db.collection(RUNS_COLLECTION).createIndex({ taskId: 1, startedAt: -1 });
  indexesEnsured = true;
}

function scopeFilter(
  tenantId: ObjectId,
  userId: ObjectId
): Filter<UserTask> {
  return { tenantId, userId };
}

export async function countUserTasksForUser(input: {
  tenantId: ObjectId;
  userId: ObjectId;
}): Promise<number> {
  await ensureUserTaskIndexes();
  const db = await getDb();
  return db.collection<UserTask>(COLLECTION).countDocuments(scopeFilter(input.tenantId, input.userId));
}

export async function listUserTasksForUser(input: {
  tenantId: ObjectId;
  userId: ObjectId;
  portfolioIdHex?: string | null;
  limit?: number;
}): Promise<UserTask[]> {
  await ensureUserTaskIndexes();
  const db = await getDb();
  const q: Filter<UserTask> = scopeFilter(input.tenantId, input.userId);
  if (input.portfolioIdHex && ObjectId.isValid(input.portfolioIdHex)) {
    const pid = new ObjectId(input.portfolioIdHex);
    q.$or = [{ portfolioId: pid }, { portfolioId: null }, { portfolioId: { $exists: false } }];
  }
  const lim = Math.min(input.limit ?? 100, 200);
  return db
    .collection<UserTask>(COLLECTION)
    .find(q)
    .sort({ updatedAt: -1 })
    .limit(lim)
    .toArray();
}

export async function getUserTaskById(input: {
  taskId: string;
  tenantId: ObjectId;
  userId: ObjectId;
}): Promise<UserTask | null> {
  if (!ObjectId.isValid(input.taskId)) {
    return null;
  }
  await ensureUserTaskIndexes();
  const db = await getDb();
  return db.collection<UserTask>(COLLECTION).findOne({
    _id: new ObjectId(input.taskId),
    ...scopeFilter(input.tenantId, input.userId)
  });
}

export async function getUserTaskByIdInternal(taskId: string): Promise<UserTask | null> {
  if (!ObjectId.isValid(taskId)) {
    return null;
  }
  await ensureUserTaskIndexes();
  const db = await getDb();
  return db.collection<UserTask>(COLLECTION).findOne({ _id: new ObjectId(taskId) });
}

export async function insertUserTask(doc: UserTask): Promise<UserTask> {
  await ensureUserTaskIndexes();
  const db = await getDb();
  const now = new Date();
  const document: UserTask = {
    ...doc,
    createdAt: doc.createdAt ?? now,
    updatedAt: doc.updatedAt ?? now
  };
  const res = await db.collection<UserTask>(COLLECTION).insertOne(document);
  return { ...document, _id: res.insertedId };
}

export async function updateUserTask(input: {
  taskId: string;
  tenantId: ObjectId;
  userId: ObjectId;
  patch: Partial<
    Pick<
      UserTask,
      | "name"
      | "description"
      | "prompt"
      | "personaId"
      | "type"
      | "portfolioId"
      | "scheduleCron"
      | "scheduleRRule"
      | "scheduleDescription"
      | "schedulePreset"
      | "timeZone"
      | "nextRunAt"
      | "enabled"
      | "delivery"
      | "params"
    >
  > & { updatedByUserId: ObjectId };
}): Promise<UserTask | null> {
  const existing = await getUserTaskById({
    taskId: input.taskId,
    tenantId: input.tenantId,
    userId: input.userId
  });
  if (!existing?._id) {
    return null;
  }
  await ensureUserTaskIndexes();
  const db = await getDb();
  const $set: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUserId: input.patch.updatedByUserId
  };
  const fields = input.patch;
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    if (key === "updatedByUserId") {
      continue;
    }
    const v = fields[key];
    if (v !== undefined) {
      $set[key] = v;
    }
  }
  await db.collection<UserTask>(COLLECTION).updateOne(
    { _id: existing._id, ...scopeFilter(input.tenantId, input.userId) },
    { $set }
  );
  return getUserTaskById({
    taskId: input.taskId,
    tenantId: input.tenantId,
    userId: input.userId
  });
}

export async function deleteUserTask(input: {
  taskId: string;
  tenantId: ObjectId;
  userId: ObjectId;
}): Promise<boolean> {
  const existing = await getUserTaskById(input);
  if (!existing?._id) {
    return false;
  }
  const db = await getDb();
  const res = await db.collection<UserTask>(COLLECTION).deleteOne({
    _id: existing._id,
    ...scopeFilter(input.tenantId, input.userId)
  });
  return (res.deletedCount ?? 0) === 1;
}

export async function updateUserTaskAfterRun(input: {
  taskId: ObjectId;
  tenantId: ObjectId;
  userId: ObjectId;
  lastRunAt: Date;
  nextRunAt: Date | null;
  lastResultSnippet: string;
  lastRunId: ObjectId;
}): Promise<void> {
  const db = await getDb();
  await db.collection<UserTask>(COLLECTION).updateOne(
    {
      _id: input.taskId,
      ...scopeFilter(input.tenantId, input.userId)
    },
    {
      $set: {
        lastRunAt: input.lastRunAt,
        nextRunAt: input.nextRunAt,
        lastResultSnippet: input.lastResultSnippet,
        lastRunId: input.lastRunId,
        updatedAt: new Date()
      }
    }
  );
}

export async function insertUserTaskRun(doc: UserTaskRun): Promise<UserTaskRun> {
  await ensureUserTaskIndexes();
  const db = await getDb();
  const document: UserTaskRun = {
    ...doc,
    startedAt: doc.startedAt ?? new Date()
  };
  const res = await db.collection<UserTaskRun>(RUNS_COLLECTION).insertOne(document);
  return { ...document, _id: res.insertedId };
}

export async function finalizeUserTaskRun(
  runId: ObjectId,
  payload: Pick<UserTaskRun, "status" | "outputSnippet" | "errorCode" | "completedAt" | "durationMs" | "linkHint">
): Promise<void> {
  const db = await getDb();
  await db.collection<UserTaskRun>(RUNS_COLLECTION).updateOne(
    { _id: runId },
    {
      $set: payload
    }
  );
}

export async function listDueUserTasks(now: Date, limit = 40): Promise<UserTask[]> {
  await ensureUserTaskIndexes();
  const db = await getDb();
  return db
    .collection<UserTask>(COLLECTION)
    .find({
      enabled: true,
      nextRunAt: { $lte: now }
    })
    .sort({ nextRunAt: 1 })
    .limit(limit)
    .toArray();
}

/**
 * Claims a due task by advancing `nextRunAt`. Same race semantics as admin scheduled tasks.
 */
export async function claimDueUserTaskForExecution(input: {
  taskId: ObjectId;
  now: Date;
}): Promise<UserTask | null> {
  await ensureUserTaskIndexes();
  const db = await getDb();
  const dueFilter: Filter<UserTask> = {
    _id: input.taskId,
    enabled: true,
    nextRunAt: { $lte: input.now }
  };
  const candidate = await db.collection<UserTask>(COLLECTION).findOne(dueFilter, {
    projection: { scheduleCron: 1, scheduleRRule: 1 }
  });
  if (!candidate) {
    return null;
  }
  const nextRunAt =
    computeNextRunAtFromSchedule(
      { scheduleCron: candidate.scheduleCron, scheduleRRule: candidate.scheduleRRule },
      input.now
    ) ?? new Date(input.now.getTime() + 24 * 60 * 60 * 1000);
  return db.collection<UserTask>(COLLECTION).findOneAndUpdate(
    dueFilter,
    {
      $set: {
        lastRunAt: input.now,
        nextRunAt
      }
    },
    { returnDocument: "after" }
  );
}
