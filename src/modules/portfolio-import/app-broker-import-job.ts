import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { listPortfolioAccounts } from "@/modules/core-admin/repository";
import type { Account, ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";

import {
    applyBrokerHoldingsToMappedAccounts,
    type BrokerImportApplyResult,
    parseBrokerHoldingsAccounts,
    type ParsedBrokerAccount
} from "@/modules/portfolio-import/broker-holdings-import";

export const APP_BROKER_IMPORT_JOBS_COLLECTION = "app_broker_import_jobs";

/** Max CSV characters stored on the staging job (≈1 MiB UTF-8). */
export const APP_BROKER_IMPORT_MAX_CSV_CHARS = 1_048_576;

export type AppBrokerImportJobStatus = "pending" | "running" | "completed" | "failed";

export type AppBrokerImportJob = {
  _id?: ObjectId;
  tenantId: ObjectId;
  userId: string;
  portfolioId: ObjectId;
  broker: "merrill" | "fidelity";
  exportType: "holdings";
  csv: string;
  mappings: Record<string, string>;
  fidelityHoldingsDefaultAccountRef?: string;
  status: AppBrokerImportJobStatus;
  results?: BrokerImportApplyResult[];
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function buildBrokerImportTaskOutput(
  taskName: string,
  results: BrokerImportApplyResult[],
  jobIdHex: string
): string {
  const lines = results.map((r) => {
    const err = r.error ? ` error=${r.error}` : "";
    return `${r.label}: imported=${r.imported} skipped_non_stock=${r.skippedNonStock} deleted_prior=${r.deletedPrior}${err}`;
  });
  return `sync-broker: app import job=${jobIdHex} task="${taskName}"\n${lines.join("\n")}`;
}

export async function insertAppBrokerImportJob(doc: Omit<AppBrokerImportJob, "_id">): Promise<ObjectId> {
  const db = await getDb();
  const res = await db.collection<AppBrokerImportJob>(APP_BROKER_IMPORT_JOBS_COLLECTION).insertOne(doc);
  return res.insertedId;
}

export async function getAppBrokerImportJobForTenant(
  jobId: ObjectId,
  tenantId: string
): Promise<AppBrokerImportJob | null> {
  const db = await getDb();
  const tenantOid = ObjectId.isValid(tenantId) ? new ObjectId(tenantId) : null;
  if (!tenantOid) {
    return null;
  }
  return db.collection<AppBrokerImportJob>(APP_BROKER_IMPORT_JOBS_COLLECTION).findOne({
    _id: jobId,
    tenantId: tenantOid
  });
}

export async function updateAppBrokerImportJob(
  jobId: ObjectId,
  patch: Partial<Pick<AppBrokerImportJob, "status" | "results" | "errorMessage" | "updatedAt">>
): Promise<void> {
  const db = await getDb();
  await db.collection<AppBrokerImportJob>(APP_BROKER_IMPORT_JOBS_COLLECTION).updateOne(
    { _id: jobId },
    { $set: { ...patch, updatedAt: patch.updatedAt ?? new Date() } }
  );
}

/**
 * True while an app-user broker import job for this portfolio is pending or running
 * (live quote fetches should be skipped so partial deletes + upserts are not priced mid-sync).
 */
export async function hasActiveAppBrokerImportForPortfolio(input: {
  portfolioIdHex: string;
  userId: string;
  tenantId: string;
}): Promise<boolean> {
  if (!ObjectId.isValid(input.portfolioIdHex)) {
    return false;
  }
  const tenantOid = ObjectId.isValid(input.tenantId) ? new ObjectId(input.tenantId) : null;
  if (!tenantOid) {
    return false;
  }
  const db = await getDb();
  const hit = await db.collection<AppBrokerImportJob>(APP_BROKER_IMPORT_JOBS_COLLECTION).findOne(
    {
      portfolioId: new ObjectId(input.portfolioIdHex),
      userId: input.userId,
      tenantId: tenantOid,
      status: { $in: ["pending", "running"] }
    },
    { projection: { _id: 1 } }
  );
  return hit != null;
}

/**
 * Validates broker CSV → portfolio account mapping: accounts must belong to the book,
 * custodian `type` must match the import broker, and `extAccountId` must match the broker row ref.
 */
export function validateBrokerImportMappings(
  parsedAccounts: ParsedBrokerAccount[],
  mappings: Record<string, string>,
  portfolioAccounts: Account[],
  broker: "merrill" | "fidelity"
): string | null {
  const byId = new Map<string, Account>();
  for (const a of portfolioAccounts) {
    const id = a._id?.toHexString();
    if (id) {
      byId.set(id, a);
    }
  }
  const allowed = new Set(byId.keys());

  const accountIdsUsed = [...new Set(Object.values(mappings).map((s) => s.trim()).filter(Boolean))];
  for (const id of accountIdsUsed) {
    if (!allowed.has(id)) {
      return "One or more mapped accounts are not in this portfolio";
    }
    const acct = byId.get(id);
    if (acct && acct.type !== broker) {
      return `Mapped account "${acct.name}" must have broker type "${broker}" for this import`;
    }
  }

  for (const acc of parsedAccounts) {
    const key = acc.accountRef || acc.label || "default";
    const mappedId = mappings[key]?.trim();
    if (!mappedId) {
      return `Missing mapping for broker account key "${key}"`;
    }
    const target = byId.get(mappedId);
    if (!target) {
      continue;
    }
    const expected = (acc.accountRef || acc.label || "").trim();
    if (!expected) {
      return `Broker row "${key}" has no account reference; cannot match portfolio ext ref`;
    }
    const ext = (target.extAccountId ?? "").trim();
    if (ext !== expected) {
      return `Account ref mismatch for "${key}": portfolio ext ref "${ext || "—"}" must equal broker ref "${expected}"`;
    }
  }

  return null;
}

/**
 * Executes a staged app-user broker import referenced from a `sync-broker` scheduled task.
 */
export async function runScheduledAppBrokerImportTask(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const jobOid = task.appBrokerImportJobId;
  if (!jobOid || !task.tenantId) {
    return {
      status: "success",
      output: `Broker sync completed for task "${task.name}".`
    };
  }

  const job = await getAppBrokerImportJobForTenant(jobOid, task.tenantId.toHexString());
  if (!job) {
    return {
      status: "failed",
      output: `sync-broker: missing app_broker_import_jobs row for task "${task.name}" jobId=${jobOid.toHexString()}`
    };
  }

  const now = new Date();
  await updateAppBrokerImportJob(jobOid, { status: "running", updatedAt: now });

  const { accounts: parsedAccounts, parseError } = parseBrokerHoldingsAccounts(
    job.broker,
    job.csv,
    job.fidelityHoldingsDefaultAccountRef ?? ""
  );
  if (parseError || parsedAccounts.length === 0) {
    const msg = parseError ?? "No accounts parsed from CSV";
    await updateAppBrokerImportJob(jobOid, {
      status: "failed",
      errorMessage: msg,
      updatedAt: new Date()
    });
    return {
      status: "failed",
      output: `sync-broker: parse failed for task "${task.name}": ${msg}`
    };
  }

  const portfolioAccounts = await listPortfolioAccounts({
    userId: job.userId,
    portfolioId: job.portfolioId.toHexString(),
    tenantId: job.tenantId.toHexString()
  });
  const mapErr = validateBrokerImportMappings(
    parsedAccounts,
    job.mappings,
    portfolioAccounts,
    job.broker
  );
  if (mapErr) {
    await updateAppBrokerImportJob(jobOid, {
      status: "failed",
      errorMessage: mapErr,
      updatedAt: new Date()
    });
    return {
      status: "failed",
      output: `sync-broker: mapping validation failed for task "${task.name}": ${mapErr}`
    };
  }

  try {
    const results = await applyBrokerHoldingsToMappedAccounts({
      userId: job.userId,
      tenantId: job.tenantId.toHexString(),
      portfolioId: job.portfolioId.toHexString(),
      parsedAccounts,
      mappings: job.mappings
    });
    await updateAppBrokerImportJob(jobOid, {
      status: "completed",
      results,
      updatedAt: new Date()
    });
    const output = buildBrokerImportTaskOutput(task.name, results, jobOid.toHexString());
    const anyErr = results.some((r) => r.error);
    return {
      status: anyErr ? "failed" : "success",
      output
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateAppBrokerImportJob(jobOid, {
      status: "failed",
      errorMessage: msg,
      updatedAt: new Date()
    });
    return {
      status: "failed",
      output: `sync-broker: apply failed for task "${task.name}": ${msg}`
    };
  }
}

