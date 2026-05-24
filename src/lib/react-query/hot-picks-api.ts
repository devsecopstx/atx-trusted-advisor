import type { HotPicksBias, HotPicksPayload, HotPicksScope } from "@/modules/portfolios/hot-picks-types";

export type FetchHotPicksParams = {
  scope: HotPicksScope;
  bias: HotPicksBias;
  portfolioId: string | null;
  minEdgeScore: number;
  maxEdgeScore: number;
  showGreeks: boolean;
  showIvSkew: boolean;
};

export async function fetchHotPicks(params: FetchHotPicksParams): Promise<HotPicksPayload> {
  const qs = new URLSearchParams({
    scope: params.scope,
    bias: params.bias,
    minEdgeScore: String(params.minEdgeScore),
    maxEdgeScore: String(90)
  });
  if (params.portfolioId) {
    qs.set("portfolioId", params.portfolioId);
  }
  const res = await fetch(`/api/portfolios/hot-picks?${qs.toString()}`, {
    credentials: "include",
    cache: "no-store"
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: HotPicksPayload;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? "Could not load hot picks");
  }
  if (!body.data) {
    throw new Error("Invalid hot picks response");
  }
  return body.data;
}
