import { randomUUID } from "node:crypto";

/**
 * Wire contract for topic `alerts.v1` (or env `ALERTS_PUBSUB_TOPIC`).
 * Subscribers filter by `userId` / `tenantId` / `severity` / `kind`.
 */
export type AppUserAlertPubSubEvent = {
  event: "created" | "updated" | "dismissed";
  alertId: string;
  userId: string;
  tenantId: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  occurredAt: string;
  correlationId: string;
  payload?: Record<string, unknown>;
};

function resolveProjectId(): string | undefined {
  const raw =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim();
  return raw || undefined;
}

/**
 * Publishes when `ALERTS_PUBSUB_TOPIC` and a GCP project id are set.
 * No-ops when unset (local CI / dev).
 */
export async function publishAppUserAlertEvent(
  payload: Omit<AppUserAlertPubSubEvent, "correlationId"> & { correlationId?: string }
): Promise<void> {
  const topicName = process.env.ALERTS_PUBSUB_TOPIC?.trim();
  const projectId = resolveProjectId();
  if (!topicName || !projectId) {
    return;
  }

  const body: AppUserAlertPubSubEvent = {
    ...payload,
    correlationId: payload.correlationId ?? randomUUID()
  };

  try {
    const { PubSub } = await import("@google-cloud/pubsub");
    const pubsub = new PubSub({ projectId });
    await pubsub.topic(topicName).publishMessage({
      data: Buffer.from(JSON.stringify(body), "utf8"),
      attributes: {
        event: body.event,
        userId: body.userId,
        tenantId: body.tenantId,
        kind: body.kind,
        severity: body.severity
      }
    });
  } catch (error) {
    console.error("[alerts-pubsub] publish failed", error);
  }
}
