import type { HoldingsChainGlance } from "@/app/portfolio/lib/holdings-row-metrics";

export async function fetchChainGlance(
  symbols: readonly string[]
): Promise<Record<string, HoldingsChainGlance | null>> {
  const list = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (list.length === 0) {
    return {};
  }
  const qs = list.map((s) => encodeURIComponent(s)).join(",");
  const res = await fetch(`/api/market/chain-glance?symbols=${qs}`, { credentials: "include" });
  const payload = (await res.json()) as { data?: Record<string, HoldingsChainGlance | null> };
  return payload.data ?? {};
}
