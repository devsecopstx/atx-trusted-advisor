import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  listRecommendationsForUser: vi.fn(),
  createRecommendation: vi.fn(),
  getRecommendationForUser: vi.fn()
}));

const publishMocks = vi.hoisted(() => ({
  publishRecommendationEvent: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const limitMocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  extractClientRateLimitKey: vi.fn<(request: Request) => string>()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));
vi.mock("@/lib/distributed-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distributed-rate-limit")>();
  return {
    ...actual,
    checkDistributedRateLimit: limitMocks.checkDistributedRateLimit,
    extractClientRateLimitKey: limitMocks.extractClientRateLimitKey
  };
});

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/recommendations/repository", () => repoMocks);
vi.mock("@/lib/pubsub/recommendations-publish", () => publishMocks);

import { GET as getById } from "@/app/api/recommendations/[recommendationId]/route";
import { GET as listRecommendations, POST as postRecommendation } from "@/app/api/recommendations/route";

const viewerSession = {
  userId: "507f1f77bcf86cd799439011",
  email: "user@example.com",
  username: "tester",
  roles: ["viewer"],
  tenantId: "507f1f77bcf86cd799439033",
  tenantRole: "member",
  xUserId: "x-1"
};

function sampleRecommendation(overrides: Partial<{ userId: string }> = {}) {
  const id = new ObjectId();
  const now = new Date();
  return {
    _id: id,
    tenantId: new ObjectId(viewerSession.tenantId),
    userId: overrides.userId ?? viewerSession.userId,
    title: "Buy TSLA dips",
    summary: "DCA plan",
    scopeTags: ["TSLA"],
    payload: {},
    status: "active" as const,
    source: "user" as const,
    createdAt: now,
    updatedAt: now
  };
}

describe("/api/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    limitMocks.extractClientRateLimitKey.mockReturnValue("127.0.0.1");
    limitMocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAtMs: Date.now() + 60_000,
      retryAfterSeconds: 60,
      source: "memory"
    });
    authMocks.requireSessionUser.mockResolvedValue(viewerSession);
    publishMocks.publishRecommendationEvent.mockResolvedValue(undefined);
  });

  it("GET returns 401 when unauthenticated", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await listRecommendations(new Request("http://test/api/recommendations"));
    expect(res.status).toBe(401);
  });

  it("GET returns 403 when session has no login-eligible role", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce({
      ...viewerSession,
      roles: []
    });
    const res = await listRecommendations(new Request("http://test/api/recommendations"));
    expect(res.status).toBe(403);
  });

  it("GET returns list for viewer", async () => {
    const doc = sampleRecommendation();
    repoMocks.listRecommendationsForUser.mockResolvedValue([doc]);
    const res = await listRecommendations(new Request("http://test/api/recommendations"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { _id: string; title: string }[] };
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Buy TSLA dips");
    expect(repoMocks.listRecommendationsForUser).toHaveBeenCalledWith({
      userId: viewerSession.userId,
      tenantId: viewerSession.tenantId,
      limit: 50
    });
  });

  it("GET returns 429 when list limiter blocks", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 30_000,
      retryAfterSeconds: 30,
      source: "memory"
    });
    const res = await listRecommendations(new Request("http://test/api/recommendations"));
    const payload = (await res.json()) as { error: string };
    expect(res.status).toBe(429);
    expect(payload.error).toBe("rate_limit_exceeded");
    expect(authMocks.requireSessionUser).not.toHaveBeenCalled();
  });

  it("POST creates and publishes event", async () => {
    const base = sampleRecommendation();
    const doc = { ...base, title: "New idea", scopeTags: ["RKLB"] };
    repoMocks.createRecommendation.mockResolvedValue(doc);
    const res = await postRecommendation(
      new Request("http://127.0.0.1/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New idea", scopeTags: ["RKLB"] })
      })
    );
    expect(res.status).toBe(201);
    expect(repoMocks.createRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: viewerSession.userId,
        tenantId: viewerSession.tenantId,
        title: "New idea",
        scopeTags: ["RKLB"],
        source: "user"
      })
    );
    expect(publishMocks.publishRecommendationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "created",
        userId: viewerSession.userId,
        tenantId: viewerSession.tenantId,
        scopeTags: ["RKLB"]
      })
    );
  });

  it("POST returns 429 when create limiter blocks", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 30_000,
      retryAfterSeconds: 30,
      source: "memory"
    });
    const res = await postRecommendation(
      new Request("http://127.0.0.1/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "blocked" })
      })
    );
    expect(res.status).toBe(429);
    expect(authMocks.requireSessionUser).not.toHaveBeenCalled();
  });

  it("POST returns 400 for empty title", async () => {
    const res = await postRecommendation(
      new Request("http://127.0.0.1/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "  " })
      })
    );
    expect(res.status).toBe(400);
    expect(repoMocks.createRecommendation).not.toHaveBeenCalled();
  });

  it("GET by id returns 404 for other user doc", async () => {
    repoMocks.getRecommendationForUser.mockResolvedValue(null);
    const res = await getById(new Request("http://127.0.0.1/api/recommendations/abc"), {
      params: Promise.resolve({ recommendationId: new ObjectId().toHexString() })
    });
    expect(res.status).toBe(404);
  });

  it("GET by id returns 200 when owned", async () => {
    const doc = sampleRecommendation();
    repoMocks.getRecommendationForUser.mockResolvedValue(doc);
    const res = await getById(new Request("http://127.0.0.1/api/recommendations/x"), {
      params: Promise.resolve({ recommendationId: doc._id!.toHexString() })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { title: string } };
    expect(json.data.title).toBe("Buy TSLA dips");
  });

  it("GET by id returns 429 when read limiter blocks", async () => {
    limitMocks.checkDistributedRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAtMs: Date.now() + 20_000,
      retryAfterSeconds: 20,
      source: "memory"
    });
    const res = await getById(new Request("http://127.0.0.1/api/recommendations/x"), {
      params: Promise.resolve({ recommendationId: new ObjectId().toHexString() })
    });
    expect(res.status).toBe(429);
    expect(authMocks.requireSessionUser).not.toHaveBeenCalled();
  });
});
