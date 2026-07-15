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
import { createMarketingSchedule, listMarketingSchedules } from "@/modules/marketing/repository";
import { serializeMarketingSchedule } from "@/modules/marketing/serialize";
import { MARKETING_PLATFORMS } from "@/modules/marketing/types";

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

const createMarketingScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    enabled: z.boolean().default(true),
    systemWide: z.boolean().default(true),
    tenantId: objectIdHexSchema.optional(),
    schedule: scheduledTaskScheduleObjectSchema,
    scheduleCron: z.string().trim().min(5).max(128).optional(),
    scheduleRRule: z.string().trim().min(1).max(1024).optional(),
    scheduleDescription: z.string().trim().min(1).max(280).optional(),
    config: marketingConfigSchema
  })
  .superRefine((value, ctx) => {
    if (!value.systemWide && !value.tenantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tenantId is required when systemWide is false",
        path: ["tenantId"]
      });
    }
  });

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  const schedules = await listMarketingSchedules();
  const labels = await resolveAdminTenantLabelsByHex(
    schedules.map((task) => task.tenantId?.toHexString())
  );
  return NextResponse.json({
    data: schedules.map((task) =>
      serializeMarketingSchedule(task, pickAdminTenantLabel(labels, task.tenantId?.toHexString()))
    )
  });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantIdHex = await requireAdminTenantIdHex(session);
  if (tenantIdHex instanceof NextResponse) {
    return tenantIdHex;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createMarketingScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const systemWide = parsed.data.systemWide !== false;
  const scopeTenantId = systemWide ? undefined : parsed.data.tenantId;
  if (!systemWide && scopeTenantId) {
    const tenant = await getTenantByHexId(scopeTenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
    }
  }

  const normalizedSchedule = normalizeScheduledTaskSchedule(parsed.data);
  const scheduleValidation = validateScheduleInput(normalizedSchedule);
  if (!scheduleValidation.ok) {
    return NextResponse.json({ error: scheduleValidation.message ?? "Invalid schedule payload" }, { status: 400 });
  }

  try {
    const created = await createMarketingSchedule({
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      systemWide,
      tenantId: scopeTenantId,
      scheduleCron: normalizedSchedule.scheduleCron,
      scheduleRRule: normalizedSchedule.scheduleRRule,
      scheduleDescription: normalizedSchedule.scheduleDescription,
      config: parsed.data.config
    });
    const labels = await resolveAdminTenantLabelsByHex([created.tenantId?.toHexString()]);
    return NextResponse.json(
      {
        data: serializeMarketingSchedule(
          created,
          pickAdminTenantLabel(labels, created.tenantId?.toHexString())
        )
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
