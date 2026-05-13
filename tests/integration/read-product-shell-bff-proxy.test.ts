import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: bffMocks.proxyPortfolioRequestToBackend
  };
});

import { GET as getProductShellReadFacade } from "@/app/api/read/product-shell-v1/route";

describe("read product shell v1 API BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
  });

  it("GET returns backend JSON when proxy resolves non-null", async () => {
    const proxied = new Response(
      JSON.stringify({
        data: {
          facadeVersion: 1,
          defaultPortfolio: { _id: "507f1f77bcf86cd799439033", name: "remote" },
          workspaceSnapshot: null
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", "X-Atx-Read-Facade-Total-Ms": "12" } }
    );
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);
    const req = new Request("http://test/api/read/product-shell-v1?workspaceContentRev=0&includeSnapshot=false");
    const res = await getProductShellReadFacade(req);
    expect(res.status).toBe(200);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    const body = (await res.json()) as { data: { defaultPortfolio: { name: string } } };
    expect(body.data.defaultPortfolio.name).toBe("remote");
    expect(res.headers.get("X-Atx-Read-Facade-Total-Ms")).toBe("12");
  });
});
