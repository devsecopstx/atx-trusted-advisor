import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  adminListPortfolioDeliveryChannels: vi.fn()
}));

const sendMailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: "test-id" }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock }))
  }
}));

vi.mock("@/modules/core-admin/repository", () => ({
  adminListPortfolioDeliveryChannels: repoMocks.adminListPortfolioDeliveryChannels
}));

import {
    dispatchPortfolioDeskEvents,
    dispatchPortfolioDeskEventsToSlack
} from "@/modules/notifications/portfolio-notification-service";

describe("dispatchPortfolioDeskEventsToSlack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMailMock.mockClear();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.DESK_EMAIL_FROM;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
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
    expect(r.email).toEqual({ targets: 1, sent: 0, skipped: 1, failed: 0 });
  });

  it("sends email when SMTP env is configured", async () => {
    process.env.SMTP_HOST = "mail.example.com";
    process.env.SMTP_USER = "desk@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.DESK_EMAIL_FROM = "desk@example.com";

    const pid = new ObjectId();
    repoMocks.adminListPortfolioDeliveryChannels.mockResolvedValueOnce([
      {
        kind: "email",
        enabled: true,
        destination: "client@example.com",
        label: "e",
        userId: "u",
        portfolioId: pid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    const r = await dispatchPortfolioDeskEvents("507f1f77bcf86cd799439011", [{ title: "T" }]);
    expect(r.email).toEqual({ targets: 1, sent: 1, skipped: 0, failed: 0 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const arg = sendMailMock.mock.calls[0]?.[0] as { to?: string; subject?: string };
    expect(arg.to).toBe("client@example.com");
    expect(arg.subject).toContain("desk alerts");
  });
});
