import type { Filter, ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

import {
  TENANT_ADMIN_EXPORT_JOBS_COLLECTION,
  type TenantExportArtifactKind,
  type TenantExportJob,
  type TenantExportJobArtifact,
  type TenantExportJobStatus
} from "@/modules/platform/tenant-admin-export-types";

export async function ensureTenantExportJobIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection(TENANT_ADMIN_EXPORT_JOBS_COLLECTION).createIndexes([
    {
      key: { tenantId: 1, createdAt: -1 },
      name: "tenant_export_jobs_tenant_created"
    },
    {
      key: { status: 1, createdAt: 1 },
      name: "tenant_export_jobs_pending_claim"
    }
  ]);
}

export async function insertTenantExportJob(input: {
  tenantId: ObjectId;
  kinds: TenantExportArtifactKind[];
  createdByUserId: ObjectId;
}): Promise<TenantExportJob> {
  const db = await getDb();
  const now = new Date();
  const doc: TenantExportJob = {
    tenantId: input.tenantId,
    kinds: [...input.kinds],
    status: "pending",
    createdAt: now,
    createdByUserId: input.createdByUserId
  };
  const res = await db.collection<TenantExportJob>(TENANT_ADMIN_EXPORT_JOBS_COLLECTION).insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function listTenantExportJobsForTenant(input: {
  tenantId: ObjectId;
  limit?: number;
}): Promise<TenantExportJob[]> {
  const db = await getDb();
  const lim = Math.min(Math.max(input.limit ?? 25, 1), 100);
  return db
    .collection<TenantExportJob>(TENANT_ADMIN_EXPORT_JOBS_COLLECTION)
    .find({ tenantId: input.tenantId })
    .sort({ createdAt: -1 })
    .limit(lim)
    .project({
      tenantId: 1,
      kinds: 1,
      status: 1,
      createdAt: 1,
      startedAt: 1,
      completedAt: 1,
      createdByUserId: 1,
      error: 1,
      "artifacts.kind": 1,
      "artifacts.filename": 1,
      "artifacts.byteLength": 1
    })
    .toArray();
}

export async function getTenantExportJobById(input: {
  jobId: ObjectId;
  tenantId: ObjectId;
}): Promise<TenantExportJob | null> {
  const db = await getDb();
  const filter: Filter<TenantExportJob> = {
    _id: input.jobId,
    tenantId: input.tenantId
  };
  return db.collection<TenantExportJob>(TENANT_ADMIN_EXPORT_JOBS_COLLECTION).findOne(filter);
}

export async function claimNextPendingTenantExportJob(): Promise<TenantExportJob | null> {
  const db = await getDb();
  const now = new Date();
  const updated = await db.collection<TenantExportJob>(TENANT_ADMIN_EXPORT_JOBS_COLLECTION).findOneAndUpdate(
    { status: "pending" as TenantExportJobStatus },
    { $set: { status: "running" as TenantExportJobStatus, startedAt: now } },
    { sort: { createdAt: 1 }, returnDocument: "after" }
  );
  return updated;
}

export async function markTenantExportJobCompleted(
  jobId: ObjectId,
  artifacts: TenantExportJobArtifact[]
): Promise<void> {
  const db = await getDb();
  await db.collection(TENANT_ADMIN_EXPORT_JOBS_COLLECTION).updateOne(
    { _id: jobId },
    {
      $set: {
        status: "completed" as TenantExportJobStatus,
        completedAt: new Date(),
        artifacts
      }
    }
  );
}

export async function markTenantExportJobFailed(jobId: ObjectId, message: string): Promise<void> {
  const db = await getDb();
  await db.collection(TENANT_ADMIN_EXPORT_JOBS_COLLECTION).updateOne(
    { _id: jobId },
    {
      $set: {
        status: "failed" as TenantExportJobStatus,
        completedAt: new Date(),
        error: message.slice(0, 2000)
      }
    }
  );
}
