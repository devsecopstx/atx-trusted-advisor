import type { NearestExpiryOptionsGlance } from "@/modules/find-options/options-hot-scan";
import type { MarketDayContext } from "@/modules/scanner/us-market-day-context";

export type WorkspacePulseIndex = {
  symbol: string;
  price?: number;
  changePercent?: number;
};

export type WorkspacePulseNewsItem = {
  title: string;
  link: string;
  publisher?: string;
};

export type WorkspacePulseData = {
  market: MarketDayContext;
  indices: WorkspacePulseIndex[];
  news: WorkspacePulseNewsItem[];
  optionsGlance: { symbol: string; highlight: NearestExpiryOptionsGlance | null }[];
};

export async function fetchWorkspacePulse(holdingsKey: string): Promise<WorkspacePulseData> {
  const qs = holdingsKey.trim() ? `?holdings=${encodeURIComponent(holdingsKey.trim())}` : "";
  const res = await fetch(`/api/market/workspace-pulse${qs}`, {
    credentials: "include",
    cache: "no-store"
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: WorkspacePulseData;
  };
  if (!res.ok) {
    throw new Error(body.error ?? `Workspace pulse failed (${res.status})`);
  }
  if (!body.data) {
    throw new Error("Missing workspace pulse payload");
  }
  return body.data;
}
