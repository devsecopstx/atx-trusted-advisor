export type XchatTokenStatsPayload = {
  totalTokens: number;
  turnsWithUsage: number;
  tokensPerMinuteAvg60m: number;
  windowMinutes: number;
};

export async function fetchXchatTokenStats(): Promise<XchatTokenStatsPayload> {
  const res = await fetch("/api/app-user/xchat/token-stats", {
    credentials: "include",
    cache: "no-store"
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: XchatTokenStatsPayload;
  };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (!body.data) {
    throw new Error("Missing stats payload");
  }
  return body.data;
}
