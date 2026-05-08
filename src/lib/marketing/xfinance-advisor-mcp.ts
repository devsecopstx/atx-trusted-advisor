/**
 * Public MCP repo URL for marketing CTAs. Override in deploy env when the canonical repo differs.
 * @see `.env.example` — `NEXT_PUBLIC_XFINANCE_ADVISOR_MCP_URL`
 */
export function resolveXfinanceAdvisorMcpUrl(): string {
  const raw = process.env.NEXT_PUBLIC_XFINANCE_ADVISOR_MCP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw;
  }
  return "https://github.com/atx-trusted-advisor/xfinance-advisor-mcp";
}
