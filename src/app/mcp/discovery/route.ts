/**
 * MCP Discovery Document — fintech-advisor.ai/mcp/discovery
 *
 * This is a stable, machine-readable manifest for the native Rental AI MCP server.
 * It is intended for:
 *   - Grok / other MCP clients doing self-onboarding
 *   - Partner documentation generators
 *   - LLM agents that want to understand capabilities without calling tools/list first
 *
 * Endpoint:
 *   GET https://fintech-advisor.ai/mcp/discovery
 */

import { tools } from "../route"; // reuse the canonical tool definitions

export async function GET() {
  const manifest = {
    schema_version: "1.0",
    server: {
      name: "rental-ai-native-mcp",
      version: "1.0.0",
      description:
        "Native Model Context Protocol server for the aTx Finance Rental AI (white-label). " +
        "Provides options-aware, tenant-isolated financial reasoning powered by Grok.",
      url: "https://fintech-advisor.ai/mcp",
      protocol: "mcp",
      transport: ["streamable-http", "json-rpc-over-post"],
    },

    authentication: {
      type: "bearer",
      header: "Authorization",
      format: "Bearer atxr_<16-hex-id>_<64-hex-secret>",
      description:
        "Standard Rental AI API key. Keys are minted per tenant via the admin API and carry scopes (chat, strategy, analyze).",
    },

    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
      streaming_chat: true, // rental_ai_chat accepts { stream: true }
    },

    rate_limits: {
      note: "Per-tenant daily token budget (default 200k tokens / UTC day). " +
            "Concurrency limits may apply. See metering headers on responses.",
    },

    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    })),

    recommended_usage: {
      grok_connector_url: "https://fintech-advisor.ai/mcp",
      example_tool_call: {
        rental_ai_chat: {
          message: "Run a conservative wheel income analysis on my NVDA and SPY positions.",
          stream: false,
        },
      },
    },

    links: {
      docs: "https://fintech-advisor.ai",
      openapi: "https://fintech-advisor.ai/api/openapi?tag=rental-ai",
      public_handoff: "https://github.com/atxfinance/xfinance-advisor-mcp",
    },

    contact: {
      security: "security@fintech-advisor.ai",
    },
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300", // 5 minutes is fine
    },
  });
}
