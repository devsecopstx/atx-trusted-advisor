import { describe, expect, it, vi } from "vitest";

import * as slackWebhook from "@/lib/post-slack-incoming-webhook";
import * as repository from "@/modules/core-admin/repository";
import { notifyScheduledTaskSlackSummary } from "@/modules/core-admin/scheduled-task-slack-notify";
import type { ScheduledTask } from "@/modules/core-admin/types";
import { ObjectId } from "mongodb";

describe("notifyScheduledTaskSlackSummary", () => {
  it("posts to Slack when task has a Slack delivery channel", async () => {
    const channelId = new ObjectId();
    const postSpy = vi.spyOn(slackWebhook, "postSlackIncomingWebhook").mockResolvedValue(true);
    vi.spyOn(repository, "getAdminDeliveryChannelById").mockResolvedValue({
      _id: channelId,
      name: "Desk",
      deliveryTarget: "slack",
      slackWebhookUrl: "https://hooks.slack.com/services/T/B/xx",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const task: ScheduledTask = {
      _id: new ObjectId(),
      name: "price-scanner-job",
      category: "price_scanner",
      enabled: true,
      deliveryChannelTarget: channelId
    };

    await notifyScheduledTaskSlackSummary({
      task,
      status: "success",
      output: "price_scanner: items_updated=3",
      durationMs: 1200,
      runIdHex: "507f1f77bcf86cd799439011",
      triggeredBy: "admin"
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    const arg = postSpy.mock.calls[0]?.[1];
    expect(arg?.text).toContain("price-scanner-job");
    expect(arg?.text).toContain("items_updated=3");
    expect(arg?.text).toContain("507f1f77bcf86cd799439011");

    postSpy.mockRestore();
  });

  it("no-ops when deliveryChannelTarget is unset", async () => {
    const postSpy = vi.spyOn(slackWebhook, "postSlackIncomingWebhook");
    const getSpy = vi.spyOn(repository, "getAdminDeliveryChannelById");

    const task: ScheduledTask = {
      name: "x",
      category: "price_scanner",
      enabled: true
    };

    await notifyScheduledTaskSlackSummary({
      task,
      status: "success",
      output: "ok",
      durationMs: 1,
      runIdHex: "a".repeat(24),
      triggeredBy: "t"
    });

    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });
});
