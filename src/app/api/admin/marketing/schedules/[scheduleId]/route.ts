import { NextResponse } from "next/server";
import { z } from "zod";

import {
    pickAdminTenantLabel,
    resolveAdminTenantLabelsByHex
} from "@/lib/admin-scheduled-task-tenant-labels";
import { requireAdminSession, requireAdminTenantIdHex } from "@/lib/api-auth";
import { normalizeScheduledTaskSchedule, scheduledTaskScheduleObjectSchema } from "@/lib/scheduled-task-request-payload";
import { validateScheduleInput } from "@/lib/scheduled-task-schedule";
import { getTenantByHexId } from "@/modules/identity/repository";
import { deleteMarketingSchedule, getMarketingScheduleById, updateMarketingSchedule } from "@/modules/marketing/repository";
import { serializeMarketingSchedule } from "@/modules/marketing/serialize";
import { MARKETING_PLATFORMS } from "@/modules/marketing/types";

type RouteContext = { params: Promise<{ scheduleId: string }> };

const marketingPlatformSchema = z.enum(MARKETING_PLATFORMS);
const objectIdHexSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, "Invalid tenant id");

const marketingConfigSchema = z.object({
  templateId: z.string().trim().optional(),
  customContent: z.string().trim().max(5000).optional(),
  generationPrompt: z.string().trim().max(6000).optional(),
  platforms: z.array(marketingPlatformSchema).min(1),
  destinationUrl: z.string().url(),
  utmParams: z.object({
    utm_source: z.string().trim().min(1),
    utm_campaign: z.string().trim().min(1),
    utm_medium: z.string().trim().optional(),
    utm_content: z.string().trim().optional(),
    utm_term: z.string().trim().optional()
  }),
  imageUrl: z.string().url().optional()
});

const patchMarketingScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    enabled: z.boolean().optional(),
    systemWide: z.boolean().optional(),
    tenantId: objectIdHexSchema.optional(),
    schedule: scheduledTaskScheduleObjectSchema,
    scheduleCron: z.string().trim().min(5).max(128).optional(),
    scheduleRRule: z.union([z.string().trim().min(1).max(1024), z.null()]).optional(),
    scheduleDescription: z.string().trim().min(1).max(280).optional(),
    nextRunAt: z.union([z.coerce.date(), z.null()]).optional(),
    config: marketingConfigSchema.optional()
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.enabled !== undefined ||
      v.systemWide !== undefined ||
      v.tenantId !== undefined ||
      v.schedule !== undefined ||
      v.scheduleCron !== undefined ||
      v.scheduleRRule !== undefined ||
      v.scheduleDescription !== undefined ||
      v.nextRunAt !== undefined ||
      v.config !== undefined,
    { message: "At least one field is required" }
  );

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const { scheduleId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchMarketingScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const current = await getMarketingScheduleById(scheduleId);
  if (!current) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const nextSystemWide =
    parsed.data.systemWide !== undefined ? parsed.data.systemWide : !current.tenantId;
  const nextTenantId = nextSystemWide
    ? undefined
    : parsed.data.tenantId ?? current.tenantId?.toHexString();
  if (!nextSystemWide && !nextTenantId) {
    return NextResponse.json(
      { error: "tenantId is required when systemWide is false" },
      { status: 400 }
    );
  }
  if (!nextSystemWide && nextTenantId) {
    const tenant = await getTenantByHexId(nextTenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
    }
  }

  const normalizedSchedule = normalizeScheduledTaskSchedule(parsed.data);
  const scheduleValidation = validateScheduleInput({
    scheduleCron: normalizedSchedule.scheduleCron !== undefined ? normalizedSchedule.scheduleCron : current.scheduleCron,
    scheduleRRule: normalizedSchedule.scheduleRRule !== undefined ? normalizedSchedule.scheduleRRule : current.scheduleRRule
  });
  if (!scheduleValidation.ok) {
    return NextResponse.json({ error: scheduleValidation.message ?? "Invalid schedule payload" }, { status: 400 });
  }

  try {
    const updated = await updateMarketingSchedule(scheduleId, {
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      systemWide: parsed.data.systemWide,
      tenantId: parsed.data.tenantId,
      scheduleCron: normalizedSchedule.scheduleCron,
      scheduleRRule: normalizedSchedule.scheduleRRule,
      scheduleDescription: normalizedSchedule.scheduleDescription,
      nextRunAt: parsed.data.nextRunAt === null ? null : parsed.data.nextRunAt,
      config: parsed.data.config
    });
    if (!updated) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    const labels = await resolveAdminTenantLabelsByHex([updated.tenantId?.toHexString()]);
    return NextResponse.json({
      data: serializeMarketingSchedule(
        updated,
        pickAdminTenantLabel(labels, updated.tenantId?.toHexString())
      )
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }
  const { scheduleId } = await context.params;
  const removed = await deleteMarketingSchedule(scheduleId);
  if (!removed) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
