import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import {
  getUserAdminSettings,
  upsertUserAdminSettings
} from "@/modules/core-admin/repository";

const updateSettingsSchema = z.object({
  broker: z.object({
    provider: z.enum(["alpaca", "interactive-brokers", "paper"]),
    accountRef: z.string().min(1),
    enabled: z.boolean()
  }),
  portfolio: z.object({
    riskProfile: z.enum(["conservative", "balanced", "growth"]),
    baseCurrency: z.enum(["USD", "EUR", "GBP"]),
    rebalanceFrequencyDays: z.number().int().positive()
  }),
  account: z.object({
    accountStatus: z.enum(["active", "suspended"]),
    maxConcurrentSessions: z.number().int().min(1).max(20),
    timezone: z.string().min(1)
  }),
  notificationDefaults: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
    digestHourUTC: z.number().int().min(0).max(23)
  })
});

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  const settings = await getUserAdminSettings(userId, {
    tenantId: session.tenantId
  });

  if (!settings) {
    return NextResponse.json({ error: "User settings not found" }, { status: 404 });
  }

  return NextResponse.json({ data: settings });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { userId } = await context.params;
  const json = await request.json();
  const parsed = updateSettingsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await upsertUserAdminSettings(userId, parsed.data, {
    tenantId: session.tenantId
  });
  await createAuditEvent({
    entityType: "core_user",
    entityId: userId,
    action: "updated_settings",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      changedFields: Object.keys(parsed.data)
    }
  });
  return NextResponse.json({ data: updated });
}
