import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { DEFAULT_SCHEDULED_TASK_CRON } from "@/lib/scheduled-task-category-schema";
import {
    createScheduledTask,
    deleteScheduledTask,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts
} from "@/modules/core-admin/repository";
import { executeScheduledTask } from "@/modules/core-admin/task-runner";
import {
    APP_BROKER_IMPORT_MAX_CSV_CHARS,
    getAppBrokerImportJobForTenant,
    insertAppBrokerImportJob,
    updateAppBrokerImportJob,
    validateBrokerImportMappings
} from "@/modules/portfolio-import/app-broker-import-job";
import { parseBrokerHoldingsAccounts, previewBrokerHoldingsAccounts } from "@/modules/portfolio-import/broker-holdings-import";

const bodySchema = z.object({
  portfolioId: z.string().trim().min(1),
  broker: z.enum(["merrill", "fidelity"]),
  exportType: z.enum(["holdings"]),
  csv: z.string().min(1).max(APP_BROKER_IMPORT_MAX_CSV_CHARS),
  mappings: z.record(z.string(), z.string()).default({}),
  fidelityHoldingsDefaultAccountRef: z.string().optional(),
  dryRun: z.boolean().optional()
});

function isMappingsRecord(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== "object") return false;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");
}

/**
 * POST /api/import/broker
 * App-user broker holdings CSV import. Dry-run returns preview only. Apply path stages CSV in
 * `app_broker_import_jobs`, creates an immediate `sync-broker` scheduled task, runs it in-process,
 * then deletes the ephemeral task row (task run history remains).
 */
export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { portfolioId, broker, exportType, csv, mappings, fidelityHoldingsDefaultAccountRef, dryRun } =
    parsed.data;
  if (!isMappingsRecord(mappings)) {
    return NextResponse.json({ error: "mappings must be string-to-string" }, { status: 400 });
  }

  const portfolio = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const { accounts: parsedAccounts, parseError } = parseBrokerHoldingsAccounts(
    broker,
    csv,
    fidelityHoldingsDefaultAccountRef ?? ""
  );
  if (parseError || parsedAccounts.length === 0) {
    return NextResponse.json(
      { error: parseError ?? "No accounts parsed from CSV" },
      { status: 400 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      broker,
      exportType,
      accounts: previewBrokerHoldingsAccounts(parsedAccounts)
    });
  }

  const owned = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  const mapErr = validateBrokerImportMappings(parsedAccounts, mappings, owned, broker);
  if (mapErr) {
    return NextResponse.json({ error: mapErr }, { status: 400 });
  }

  const tenantOid = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
  if (!tenantOid) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  const now = new Date();
  const jobId = await insertAppBrokerImportJob({
    tenantId: tenantOid,
    userId: session.userId,
    portfolioId: portfolio._id,
    broker,
    exportType,
    csv,
    mappings,
    fidelityHoldingsDefaultAccountRef,
    status: "pending",
    createdAt: now,
    updatedAt: now
  });

  const taskName = `app-import-${jobId.toHexString().slice(-8)}`;
  const scheduled = await createScheduledTask({
    name: taskName,
    category: "sync-broker",
    scheduleCron: DEFAULT_SCHEDULED_TASK_CRON,
    scheduleDescription: "One-shot app broker import (immediate)",
    enabled: true,
    nextRunAt: now,
    tenantId: session.tenantId,
    portfolioId,
    appBrokerImportJobId: jobId.toHexString()
  });

  if (!scheduled._id) {
    return NextResponse.json({ error: "Failed to create import task" }, { status: 500 });
  }

  const taskIdHex = scheduled._id.toHexString();
  const deleteEphemeral = () =>
    deleteScheduledTask({
      taskId: taskIdHex,
      tenantId: session.tenantId,
      expectedPortfolioId: portfolioId
    });

  let exec: { runId: ObjectId; status: "success" | "failed"; output: string };
  try {
    exec = await executeScheduledTask(scheduled, "app_user:import_broker", {
      userId: session.userId,
      email: session.email,
      username: session.username ?? session.email
    });
  } catch (e) {
    await deleteEphemeral().catch(() => {});
    const msg = e instanceof Error ? e.message : "Import task failed";
    await updateAppBrokerImportJob(jobId, {
      status: "failed",
      errorMessage: msg,
      updatedAt: new Date()
    }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await deleteEphemeral();

  const job = await getAppBrokerImportJobForTenant(jobId, session.tenantId);

  return NextResponse.json({
    data: {
      jobId: jobId.toHexString(),
      status: exec.status,
      taskOutput: exec.output,
      runId: exec.runId.toHexString(),
      results: job?.results ?? null,
      jobStatus: job?.status ?? null,
      errorMessage: job?.errorMessage ?? null
    }
  });
}
