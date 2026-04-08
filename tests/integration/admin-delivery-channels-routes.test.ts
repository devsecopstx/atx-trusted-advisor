import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listAdminDeliveryChannels: vi.fn(),
  createAdminDeliveryChannel: vi.fn(),
  getAdminDeliveryChannelById: vi.fn(),
  updateAdminDeliveryChannelById: vi.fn(),
  deleteAdminDeliveryChannelById: vi.fn()
}));

const slackMocks = vi.hoisted(() => ({
  postSlackIncomingWebhook: vi.fn()
}));

const deskMocks = vi.hoisted(() => ({
  sendDeskPlainEmailWithRetry: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdminSession: authMocks.requireAdminSession,
    requireAdminTenantIdHex: authMocks.requireAdminTenantIdHex
  };
});
vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/lib/post-slack-incoming-webhook", () => slackMocks);
vi.mock("@/lib/desk-smtp", () => deskMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { DELETE as deleteChannel, PATCH as patchChannel } from "@/app/api/admin/delivery-channels/[channelId]/route";
import { POST as postTest } from "@/app/api/admin/delivery-channels/[channelId]/test/route";
import { GET as getChannels, POST as postChannel } from "@/app/api/admin/delivery-channels/route";

const oid = "507f1f77bcf86cd799439011";
const tenantId = "507f1f77bcf86cd799439022";

describe("admin delivery-channels routes", () => {
  afterEach(() => {
    delete process.env.DESK_DELIVERY_CHANNEL_TEST_TO;
    delete process.env.DESK_DELIVERY_CHANNEL_TEST_SUBJECT;
  });

  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: oid,
      tenantId,
      roles: ["global_admin"],
      email: "admin@atxfinance.ai",
      username: "admin"
    });
    authMocks.requireAdminTenantIdHex.mockResolvedValue(tenantId);
    repositoryMocks.listAdminDeliveryChannels.mockResolvedValue([]);
    repositoryMocks.createAdminDeliveryChannel.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Ops",
      deliveryTarget: "in_app" as const,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Ops",
      deliveryTarget: "in_app" as const,
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    repositoryMocks.updateAdminDeliveryChannelById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Ops2",
      deliveryTarget: "slack" as const,
      slackWebhookUrl: "https://hooks.slack.com/services/T/A/B",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T01:00:00.000Z")
    });
    repositoryMocks.deleteAdminDeliveryChannelById.mockResolvedValue(true);
    slackMocks.postSlackIncomingWebhook.mockResolvedValue(true);
    deskMocks.sendDeskPlainEmailWithRetry.mockResolvedValue(true);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("lists channels", async () => {
    const response = await getChannels(new Request("http://test/api/admin/delivery-channels"));
    expect(response.status).toBe(200);
    expect(repositoryMocks.listAdminDeliveryChannels).toHaveBeenCalledWith({ tenantId });
  });

  it("creates in_app channel", async () => {
    const response = await postChannel(
      new Request("http://test/api/admin/delivery-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ops", deliveryTarget: "in_app" })
      })
    );
    expect(response.status).toBe(201);
    expect(repositoryMocks.createAdminDeliveryChannel).toHaveBeenCalled();
  });

  it("rejects email without emailTo", async () => {
    const response = await postChannel(
      new Request("http://test/api/admin/delivery-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Mail", deliveryTarget: "email" })
      })
    );
    expect(response.status).toBe(400);
  });

  it("creates email channel", async () => {
    repositoryMocks.createAdminDeliveryChannel.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439088" },
      name: "Mail",
      deliveryTarget: "email",
      emailTo: "ops@example.com",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postChannel(
      new Request("http://test/api/admin/delivery-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Mail",
          deliveryTarget: "email",
          emailTo: "ops@example.com"
        })
      })
    );
    expect(response.status).toBe(201);
    expect(repositoryMocks.createAdminDeliveryChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryTarget: "email",
        emailTo: "ops@example.com"
      })
    );
  });

  it("rejects slack without webhook URL", async () => {
    const response = await postChannel(
      new Request("http://test/api/admin/delivery-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Slack", deliveryTarget: "slack" })
      })
    );
    expect(response.status).toBe(400);
  });

  it("patches channel", async () => {
    const response = await patchChannel(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ops2" })
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
  });

  it("deletes channel", async () => {
    const response = await deleteChannel(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
  });

  it("test in_app returns ok without Slack", async () => {
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok?: boolean;
      deliveryTarget?: string;
      inAppPreview?: boolean;
      message?: string;
    };
    expect(json.ok).toBe(true);
    expect(json.deliveryTarget).toBe("in_app");
    expect(json.inAppPreview).toBe(true);
    expect(json.message).toMatch(/^hello from atx \| tenant=507f1f77bcf86cd799439022 \| at=/);
    expect(slackMocks.postSlackIncomingWebhook).not.toHaveBeenCalled();
  });

  it("test slack posts hello", async () => {
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Slack",
      deliveryTarget: "slack",
      slackWebhookUrl: "https://hooks.slack.com/services/T/A/B",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    const slackJson = (await response.json()) as { detail?: string; deliveryTarget?: string };
    expect(slackJson.deliveryTarget).toBe("slack");
    expect(slackJson.detail).toContain("Slack");
    expect(slackMocks.postSlackIncomingWebhook).toHaveBeenCalledTimes(1);
    const slackCall = slackMocks.postSlackIncomingWebhook.mock.calls[0];
    expect(slackCall?.[0]).toBe("https://hooks.slack.com/services/T/A/B");
    expect(slackCall?.[1]?.text).toMatch(/^hello from atx \| tenant=507f1f77bcf86cd799439022 \| at=/);
  });

  it("test email sends via SMTP helper", async () => {
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Mail",
      deliveryTarget: "email",
      emailTo: "ops@example.com",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    const mailJson = (await response.json()) as { detail?: string; deliveryTarget?: string };
    expect(mailJson.deliveryTarget).toBe("email");
    expect(mailJson.detail).toContain("ops@example.com");
    expect(deskMocks.sendDeskPlainEmailWithRetry).toHaveBeenCalledTimes(1);
    const mailCall = deskMocks.sendDeskPlainEmailWithRetry.mock.calls[0];
    expect(mailCall?.[0]).toBe("ops@example.com");
    expect(mailCall?.[1]).toBe("aTx Finance — delivery channel test");
    expect(mailCall?.[2]).toMatch(/^hello from atx \| tenant=507f1f77bcf86cd799439022 \| at=/);
    expect(slackMocks.postSlackIncomingWebhook).not.toHaveBeenCalled();
  });

  it("test email uses DESK_DELIVERY_CHANNEL_TEST_TO when set", async () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_TO = "safe@example.com";
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Mail",
      deliveryTarget: "email",
      emailTo: "ops@example.com",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    const mailJson = (await response.json()) as {
      detail?: string;
      usedEnvRecipientOverride?: boolean;
    };
    expect(mailJson.usedEnvRecipientOverride).toBe(true);
    expect(mailJson.detail).toContain("safe@example.com");
    expect(deskMocks.sendDeskPlainEmailWithRetry).toHaveBeenCalledWith(
      "safe@example.com",
      "aTx Finance — delivery channel test",
      expect.stringMatching(/^hello from atx \| tenant=507f1f77bcf86cd799439022 \| at=/)
    );
  });

  it("test email works with empty channel emailTo when DESK_DELIVERY_CHANNEL_TEST_TO is set", async () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_TO = "safe@example.com";
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Mail",
      deliveryTarget: "email",
      emailTo: "",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    expect(deskMocks.sendDeskPlainEmailWithRetry).toHaveBeenCalledWith(
      "safe@example.com",
      expect.any(String),
      expect.any(String)
    );
  });

  it("test email returns 400 when DESK_DELIVERY_CHANNEL_TEST_TO is invalid", async () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_TO = "not-an-email";
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Mail",
      deliveryTarget: "email",
      emailTo: "ops@example.com",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("DESK_DELIVERY_CHANNEL_TEST_TO");
    expect(deskMocks.sendDeskPlainEmailWithRetry).not.toHaveBeenCalled();
  });

  it("test email uses DESK_DELIVERY_CHANNEL_TEST_SUBJECT when set", async () => {
    process.env.DESK_DELIVERY_CHANNEL_TEST_SUBJECT = "Custom SMTP test";
    repositoryMocks.getAdminDeliveryChannelById.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Mail",
      deliveryTarget: "email",
      emailTo: "ops@example.com",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    const response = await postTest(
      new Request("http://test/api/admin/delivery-channels/507f1f77bcf86cd799439099/test", {
        method: "POST"
      }),
      { params: Promise.resolve({ channelId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    expect(deskMocks.sendDeskPlainEmailWithRetry).toHaveBeenCalledWith(
      "ops@example.com",
      "Custom SMTP test",
      expect.stringMatching(/^hello from atx \| tenant=507f1f77bcf86cd799439022 \| at=/)
    );
  });
});
