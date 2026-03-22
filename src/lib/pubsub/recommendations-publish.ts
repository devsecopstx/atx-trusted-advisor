import { randomUUID } from "node:crypto";

import type { RecommendationStatus } from "@/modules/recommendations/types";

/**
 * Wire contract for topic `recommendations.v1` (or env override). Subscribers filter by `userId` / `tenantId` / `scopeTags` after loading Mongo or from companion fields.
 */
export type RecommendationPubSubEvent = {
  event: "created" | "updated";
  recommendationId: string;
  userId: string;
  tenantId: string;
  status: RecommendationStatus;
  occurredAt: string;
  correlationId: string;
  scopeTags: string[];
};

function resolveProjectId(): string | undefined {
  const raw =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim();
  return raw || undefined;
}

/**
 * Publishes when `RECOMMENDATIONS_PUBSUB_TOPIC` and a project id (`GOOGLE_CLOUD_PROJECT` | `GCLOUD_PROJECT` | `GCP_PROJECT`) are set.
 * No-ops when unset so local CI and dev do not need an emulator.
 */
export async function publishRecommendationEvent(
  payload: Omit<RecommendationPubSubEvent, "correlationId"> & { correlationId?: string }
): Promise<void> {
  const topicName = process.env.RECOMMENDATIONS_PUBSUB_TOPIC?.trim();
  const projectId = resolveProjectId();
  if (!topicName || !projectId) {
    return;
  }

  const body: RecommendationPubSubEvent = {
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
        tenantId: body.tenantId
      }
    });
  } catch (error) {
    console.error("[recommendations-pubsub] publish failed", error);
  }
}
