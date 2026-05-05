import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "@/lib/password-crypto";

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  respondWithXaiToolLoop: vi.fn()
}));

const workspaceMocks = vi.hoisted(() => ({
  buildWorkspaceServerSnapshotBlock: vi.fn()
}));

const guardMocks = vi.hoisted(() => ({
  enforceRentalAiRateLimit: vi.fn(),
  enforceRentalAiTokenBudget: vi.fn(),
  tryAcquireRentalAiConcurrencyOr429: vi.fn(),
  releaseRentalAiConcurrencySafe: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/mongodb", () => mongoMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", () => workspaceMocks);
vi.mock("@/modules/platform/rental-ai-guardrails", () => guardMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { GET as getRentAnalyze, POST as postRentAnalyze } from "@/app/api/ai/rent/analyze/route";
import { POST as postRentChat } from "@/app/api/ai/rent/chat/route";
import { GET as getRentStrategy, POST as postRentStrategy } from "@/app/api/ai/rent/strategy/route";

const TENANT_ID = new ObjectId("507f1f77bcf86cd799439010");
const PERSONA_ID = new ObjectId("507f1f77bcf86cd799439011");
const JOB_ID = new ObjectId("507f1f77bcf86cd799439099");

type TenantFixture = {
  fullKey: string;
  doc: Record<string, unknown>;
};

async function buildTenant(overrides?: {
  scopes?: string[];
  expiresAt?: Date;
  apiKeyEnabled?: boolean;
}): Promise<TenantFixture> {
  const keyId = "0123456789abcdef";
  const secret64 = "f".repeat(64);
  const fullKey = `atxr_${keyId}_${secret64}`;
  const keyHash = await hashPassword(fullKey);
  const doc = {
    _id: TENANT_ID,
    slug: "rent-test",
    rentalProfile: {
      tier: "ria",
      strategyBias: "conservative",
      maxPortfolios: 3,
      maxDailyTokens: 200_000,
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 7 * 86_400_000),
      apiKeyEnabled: overrides?.apiKeyEnabled !== false,
      defaultPersonaId: PERSONA_ID,
      sampleUserId: "rental-sample:rent-test",
      samplePortfolioId: new ObjectId("507f1f77bcf86cd799439012")
    },
    apiKeys: [
      {
        id: keyId,
        keyHash,
        scopes: overrides?.scopes ?? ["chat", "strategy", "analyze"],
        createdAt: new Date()
      }
    ]
  };
  return { fullKey, doc };
}

function wireMongo(mock: {
  tenantDoc: Record<string, unknown> | null;
  tokenUsed?: number;
  jobStore: Map<string, Record<string, unknown>>;
}) {
  const insertOne = vi.fn().mockImplementation(async (row: Record<string, unknown>) => {
    mock.jobStore.set(JOB_ID.toHexString(), { ...row, _id: JOB_ID });
    return { insertedId: JOB_ID };
  });

  const findOne = vi.fn().mockImplementation(async (query: Record<string, unknown>) => {
    const ak = query.apiKeys as { $elemMatch?: unknown } | undefined;
    if (ak?.$elemMatch) {
      return mock.tenantDoc;
    }
    if (query._id instanceof ObjectId && query.tenantId && query.scope) {
      const hit = mock.jobStore.get(query._id.toHexString());
      return hit ?? null;
    }
    if (query._id && query._id instanceof ObjectId && Object.keys(query).length === 1) {
      return {
        systemPrompt: "You are the rental persona.",
        xapiConfig: {}
      };
    }
    if (query.tenantId && query.dayUtc) {
      return { tokensUsed: mock.tokenUsed ?? 0 };
    }
    return null;
  });

  const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });

  mongoMocks.getDb.mockResolvedValue({
    collection: (name: string) => {
      if (name === "core_tenants") {
        return { findOne };
      }
      if (name === "xchat_personas") {
        return { findOne };
      }
      if (name === "rental_ai_token_usage") {
        return { findOne, updateOne };
      }
      if (name === "xchat_usage_limits") {
        return { updateOne };
      }
      if (name === "rental_ai_jobs") {
        return { findOne, insertOne };
      }
      return { findOne, updateOne, insertOne };
    }
  });

  return { findOne, insertOne };
}

describe("rental ai routes", () => {
  const jobStore = new Map<string, Record<string, unknown>>();

  beforeEach(() => {
    vi.clearAllMocks();
    jobStore.clear();
    guardMocks.enforceRentalAiRateLimit.mockResolvedValue(null);
    guardMocks.enforceRentalAiTokenBudget.mockResolvedValue(null);
    guardMocks.tryAcquireRentalAiConcurrencyOr429.mockReturnValue(null);
    guardMocks.releaseRentalAiConcurrencySafe.mockImplementation(() => {});
    workspaceMocks.buildWorkspaceServerSnapshotBlock.mockResolvedValue("Workspace: OK");
    xaiMocks.respondWithXaiToolLoop.mockResolvedValue({
      outputText: "**Hello** from rental",
      model: "grok-test",
      raw: { usage: { total_tokens: 128 } }
    });
    auditMocks.createAuditEvent.mockResolvedValue({ _id: "a1" });
  });

  it("POST chat returns 401 without authorization", async () => {
    wireMongo({ tenantDoc: null, jobStore });
    const res = await postRentChat(
      new Request("http://test/api/ai/rent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hi" })
      })
    );
    expect(res.status).toBe(401);
  });

  it("POST chat returns 403 when rental expired", async () => {
    const { fullKey, doc } = await buildTenant({ expiresAt: new Date(Date.now() - 86_400_000) });
    wireMongo({ tenantDoc: doc, jobStore });
    const res = await postRentChat(
      new Request("http://test/api/ai/rent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({ message: "Hi" })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("rental_expired");
  });

  it("POST chat returns 403 when scope excludes chat", async () => {
    const { fullKey, doc } = await buildTenant({ scopes: ["strategy"] });
    wireMongo({ tenantDoc: doc, jobStore });
    const res = await postRentChat(
      new Request("http://test/api/ai/rent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({ message: "Hi" })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("insufficient_scope");
  });

  it("POST chat returns 402 when token budget gate rejects", async () => {
    const { fullKey, doc } = await buildTenant();
    wireMongo({ tenantDoc: doc, tokenUsed: 199_000, jobStore });
    guardMocks.enforceRentalAiTokenBudget.mockResolvedValue({
      response: new Response(
        JSON.stringify({ code: "token_budget_exceeded", error: "Payment Required" }),
        { status: 402, headers: { "content-type": "application/json" } }
      )
    });
    const res = await postRentChat(
      new Request("http://test/api/ai/rent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({ message: "Hi" })
      })
    );
    expect(res.status).toBe(402);
  });

  it("POST chat returns JSON assistant payload on success", async () => {
    const { fullKey, doc } = await buildTenant();
    wireMongo({ tenantDoc: doc, jobStore });
    const res = await postRentChat(
      new Request("http://test/api/ai/rent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({ message: "Hi" })
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-rental-tokens-used")).toBeTruthy();
    expect(res.headers.get("x-rental-tokens-remaining")).toBeTruthy();
    const body = (await res.json()) as { ok: boolean; data: { response: string } };
    expect(body.ok).toBe(true);
    expect(body.data.response).toContain("Hello");
    expect(xaiMocks.respondWithXaiToolLoop).toHaveBeenCalled();
  });

  it("POST chat streams SSE when Accept is text/event-stream", async () => {
    const { fullKey, doc } = await buildTenant();
    wireMongo({ tenantDoc: doc, jobStore });
    const res = await postRentChat(
      new Request("http://test/api/ai/rent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({ message: "Hi" })
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("chat.completion.chunk");
    expect(text).toContain("[DONE]");
  });

  it("POST strategy returns 202 and GET poll returns job", async () => {
    const { fullKey, doc } = await buildTenant();
    wireMongo({ tenantDoc: doc, jobStore });
    const postRes = await postRentStrategy(
      new Request("http://test/api/ai/rent/strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({ symbols: ["tsla"] })
      })
    );
    expect(postRes.status).toBe(202);
    const postBody = (await postRes.json()) as { data: { jobId: string } };
    expect(postBody.data.jobId).toBe(JOB_ID.toHexString());

    const getRes = await getRentStrategy(
      new Request(`http://test/api/ai/rent/strategy?jobId=${postBody.data.jobId}`, {
        headers: { Authorization: `Bearer ${fullKey}` }
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { data: { status: string } };
    expect(getBody.data.status).toBe("completed");
  });

  it("POST analyze returns 202 and GET handles missing job", async () => {
    const { fullKey, doc } = await buildTenant();
    wireMongo({ tenantDoc: doc, jobStore });
    const postRes = await postRentAnalyze(
      new Request("http://test/api/ai/rent/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fullKey}`
        },
        body: JSON.stringify({})
      })
    );
    expect(postRes.status).toBe(202);

    const missing = await getRentAnalyze(
      new Request(`http://test/api/ai/rent/analyze?jobId=${new ObjectId().toHexString()}`, {
        headers: { Authorization: `Bearer ${fullKey}` }
      })
    );
    expect(missing.status).toBe(404);
  });
});
