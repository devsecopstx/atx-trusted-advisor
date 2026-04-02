import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  adminListPortfolioDeliveryChannels: vi.fn(),
}));

vi.mock("@/modules/core-admin/repository", () => ({
  adminListPortfolioDeliveryChannels: repoMocks.adminListPortfolioDeliveryChannels,
}));

import {
    dispatchPortfolioDeskEvents,
    dispatchPortfolioDeskEventsToSlack
} from "@/modules/notifications/portfolio-notification-service";

describe("dispatchPortfolioDeskEventsToSlack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zeros when events empty", async () => {
    const r = await dispatchPortfolioDeskEventsToSlack("507f1f77bcf86cd799439011", []);
    expect(r).toEqual({ targets: 0, postsOk: 0 });
    expect(repoMocks.adminListPortfolioDeliveryChannels).not.toHaveBeenCalled();
  });

  it("skips when no enabled slack webhooks", async () => {
    const pid = new ObjectId();
    repoMocks.adminListPortfolioDeliveryChannels.mockResolvedValueOnce([
      {
        kind: "email",
        enabled: true,
        destination: "a@b.com",
        label: "e",
        userId: "u",
        portfolioId: pid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const r = await dispatchPortfolioDeskEventsToSlack("507f1f77bcf86cd799439011", [{ title: "T", body: "b" }]);
    expect(r).toEqual({ targets: 0, postsOk: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to each slack_webhook and counts successes", async () => {
    const pid = new ObjectId();
    repoMocks.adminListPortfolioDeliveryChannels.mockResolvedValueOnce([
      {
        kind: "slack_webhook",
        enabled: true,
        destination: "https://hooks.slack.com/services/T/B/one",
        label: "s1",
        userId: "u",
        portfolioId: pid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        kind: "slack_webhook",
        enabled: true,
        destination: "https://hooks.slack.com/services/T/B/two",
        label: "s2",
        userId: "u",
        portfolioId: pid,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const r = await dispatchPortfolioDeskEventsToSlack("507f1f77bcf86cd799439011", [
      { title: "Alert", body: "Body", symbol: "TSLA" },
    ]);
    expect(r.targets).toBe(2);
    expect(r.postsOk).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dispatchPortfolioDeskEvents counts deferred email or sms channels", async () => {
    const pid = new ObjectId();
    repoMocks.adminListPortfolioDeliveryChannels.mockResolvedValueOnce([
      {
        kind: "slack_webhook",
        enabled: true,
        destination: "https://hooks.slack.com/services/T/B/one",
        label: "s1",
        userId: "u",
        portfolioId: pid,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        kind: "email",
        enabled: true,
        destination: "a@b.com",
        label: "e",
        userId: "u",
        portfolioId: pid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }));
    const r = await dispatchPortfolioDeskEvents("507f1f77bcf86cd799439011", [{ title: "T" }]);
    expect(r.slack.postsOk).toBe(1);
    expect(r.email).toEqual({ targets: 1, skipped: 1 });
  });
});
