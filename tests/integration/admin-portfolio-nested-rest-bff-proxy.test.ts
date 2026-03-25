import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));

vi.mock("@/lib/api-auth", () => authMocks);

import { GET as getAlerts } from "@/app/api/admin/portfolios/[portfolioId]/alerts/route";
import { POST as postChannels } from "@/app/api/admin/portfolios/[portfolioId]/delivery-channels/route";
import { DELETE as deleteReco, PATCH as patchReco } from "@/app/api/admin/portfolios/[portfolioId]/recommendations/[recommendationId]/route";
import { GET as getReco, POST as postReco } from "@/app/api/admin/portfolios/[portfolioId]/recommendations/route";
import { PATCH as patchTask } from "@/app/api/admin/portfolios/[portfolioId]/tasks/[taskId]/route";

const portfolioId = "507f1f77bcf86cd799439033";
const childId = "507f1f77bcf86cd799439044";

describe("admin portfolio nested REST BFF proxy (recommendations, alerts, channels, tasks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "admin1"
    });
  });

  it("proxies GET …/recommendations", async () => {
    const proxied = new Response(JSON.stringify({ data: [] }), { status: 200 });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);
    const req = new Request(`http://t/api/admin/portfolios/${portfolioId}/recommendations`);
    const res = await getReco(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("proxies POST …/recommendations", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 201 }));
    const req = new Request(`http://t/api/admin/portfolios/${portfolioId}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "TSLA", action: "hold" })
    });
    await postReco(req, { params: Promise.resolve({ portfolioId }) });
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("proxies PATCH …/recommendations/:id", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const req = new Request(
      `http://t/api/admin/portfolios/${portfolioId}/recommendations/${childId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) }
    );
    await patchReco(req, { params: Promise.resolve({ portfolioId, recommendationId: childId }) });
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("proxies DELETE …/recommendations/:id", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const req = new Request(`http://t/api/admin/portfolios/${portfolioId}/recommendations/${childId}`, {
      method: "DELETE"
    });
    await deleteReco(req, { params: Promise.resolve({ portfolioId, recommendationId: childId }) });
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("proxies GET …/alerts and POST …/delivery-channels", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const g1 = new Request(`http://t/api/admin/portfolios/${portfolioId}/alerts`);
    await getAlerts(g1, { params: Promise.resolve({ portfolioId }) });
    expect(bffMocks.proxyRequestToBackend).toHaveBeenLastCalledWith(g1);

    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 201 }));
    const g2 = new Request(`http://t/api/admin/portfolios/${portfolioId}/delivery-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "email",
        label: "x",
        destination: "a@b.co"
      })
    });
    await postChannels(g2, { params: Promise.resolve({ portfolioId }) });
    expect(bffMocks.proxyRequestToBackend).toHaveBeenLastCalledWith(g2);
  });

  it("proxies PATCH …/tasks/:taskId", async () => {
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const req = new Request(`http://t/api/admin/portfolios/${portfolioId}/tasks/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false })
    });
    await patchTask(req, { params: Promise.resolve({ portfolioId, taskId: childId }) });
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });
});
