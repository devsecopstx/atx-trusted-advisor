import type { AdminDeliveryChannel } from "@/modules/core-admin/types";

export function serializeAdminDeliveryChannel(ch: AdminDeliveryChannel) {
  return {
    _id: ch._id?.toHexString(),
    name: ch.name,
    deliveryTarget: ch.deliveryTarget,
    slackWebhookUrl: ch.slackWebhookUrl ?? "",
    emailTo: ch.emailTo ?? "",
    createdAt: ch.createdAt.toISOString(),
    updatedAt: ch.updatedAt.toISOString()
  };
}
