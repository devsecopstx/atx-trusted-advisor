import { getDb } from "@/lib/mongodb";
import type { AuditEvent, AuditEntityType } from "@/modules/audit/types";

const collections = {
  auditEvents: "admin_audit_events"
} as const;

export async function createAuditEvent(
  payload: Omit<AuditEvent, "_id" | "createdAt">
): Promise<AuditEvent> {
  const db = await getDb();
  const document: AuditEvent = {
    ...payload,
    createdAt: new Date()
  };
  const result = await db.collection<AuditEvent>(collections.auditEvents).insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function listAuditEventsForEntity(input: {
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  const db = await getDb();
  const limit = input.limit ?? 20;
  return db
    .collection<AuditEvent>(collections.auditEvents)
    .find({
      entityType: input.entityType,
      entityId: input.entityId
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function listLatestAuditEventsForEntities(input: {
  entityType: AuditEntityType;
  entityIds: string[];
}): Promise<Record<string, AuditEvent>> {
  if (input.entityIds.length === 0) {
    return {};
  }

  const db = await getDb();
  const events = await db
    .collection<AuditEvent>(collections.auditEvents)
    .find({
      entityType: input.entityType,
      entityId: { $in: input.entityIds }
    })
    .sort({ createdAt: -1 })
    .toArray();

  const latestByEntityId: Record<string, AuditEvent> = {};
  for (const event of events) {
    if (!latestByEntityId[event.entityId]) {
      latestByEntityId[event.entityId] = event;
    }
  }
  return latestByEntityId;
}
