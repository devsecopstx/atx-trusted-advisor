import { getDb } from "@/lib/mongodb";

const COLLECTION = "tenant_ux_observability_events";

export type TenantUxObservabilityEvent = {
  type: "tenant_ux_metric" | "tenant_ux_policy_fetch_error";
  tenantId: string;
  userId?: string;
  pathname?: string;
  policyPath?: string;
  metric?: string;
  ms?: number;
  httpStatus?: number;
  ok?: boolean;
  error?: string;
  createdAt: Date;
};

export async function appendTenantUxObservabilityEvent(
  payload: Omit<TenantUxObservabilityEvent, "createdAt">
): Promise<void> {
  const db = await getDb();
  await db.collection<TenantUxObservabilityEvent>(COLLECTION).insertOne({
    ...payload,
    createdAt: new Date()
  });
}

export async function listTenantUxObservabilityEvents(input: {
  tenantId?: string;
  limit: number;
}): Promise<TenantUxObservabilityEvent[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (input.tenantId?.trim()) {
    query.tenantId = input.tenantId.trim();
  }
  return db
    .collection<TenantUxObservabilityEvent>(COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(500, input.limit)))
    .toArray();
}

export async function listTenantUxObservabilityReplay(input: {
  tenantId: string;
  sinceHours: number;
}): Promise<TenantUxObservabilityEvent[]> {
  const db = await getDb();
  const since = new Date(Date.now() - Math.max(1, Math.min(168, input.sinceHours)) * 60 * 60 * 1000);
  return db
    .collection<TenantUxObservabilityEvent>(COLLECTION)
    .find({
      tenantId: input.tenantId.trim(),
      createdAt: { $gte: since }
    })
    .sort({ createdAt: -1 })
    .limit(2_000)
    .toArray();
}
