import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import type { TenantRentalApiKeyScope } from "@/modules/platform/tenant-rental-types";

type RentalAiJobScope = Extract<TenantRentalApiKeyScope, "strategy" | "analyze">;
type RentalAiJobStatus = "accepted" | "completed" | "failed";

type RentalAiJob = {
  _id?: ObjectId;
  tenantId: ObjectId;
  apiKeyId: string;
  scope: RentalAiJobScope;
  status: RentalAiJobStatus;
  request: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

const COLLECTION = "rental_ai_jobs";

export async function createCompletedRentalAiJob(input: {
  tenantId: ObjectId;
  apiKeyId: string;
  scope: RentalAiJobScope;
  request: Record<string, unknown>;
  result: Record<string, unknown>;
}): Promise<string> {
  const db = await getDb();
  const now = new Date();
  const row: RentalAiJob = {
    tenantId: input.tenantId,
    apiKeyId: input.apiKeyId,
    scope: input.scope,
    status: "completed",
    request: input.request,
    result: input.result,
    createdAt: now,
    updatedAt: now
  };
  const inserted = await db.collection<RentalAiJob>(COLLECTION).insertOne(row);
  return inserted.insertedId.toHexString();
}

export async function getRentalAiJobForTenant(input: {
  tenantId: ObjectId;
  jobId: string;
  scope: RentalAiJobScope;
}): Promise<RentalAiJob | null> {
  if (!ObjectId.isValid(input.jobId)) {
    return null;
  }
  const db = await getDb();
  return db.collection<RentalAiJob>(COLLECTION).findOne({
    _id: new ObjectId(input.jobId),
    tenantId: input.tenantId,
    scope: input.scope
  });
}
