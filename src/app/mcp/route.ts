/**
 * Native MCP Server Endpoint — fintech-advisor.ai/mcp
 *
 * This route exposes the full Rental AI capability as a Model Context Protocol (MCP) server
 * directly from the main application.
 *
 * External agents (especially Grok) can connect to:
 *
 *     https://fintech-advisor.ai/mcp
 *
 * Using the exact same `Authorization: Bearer atxr_<id>_<secret>` keys as the regular
 * /api/ai/rent/* endpoints.
 *
 * Benefits of the native /mcp endpoint (vs the public proxy):
 * - Direct access to internal logic, personas, workspace snapshots, and RAG
 * - Same guardrails, token metering, auditing, and concurrency controls
 * - "Self-onboard" for tenants — just mint a key and point Grok at this URL
 */

import { randomUUID } from "node:crypto";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { authenticateRentalAiApiKey } from "@/modules/platform/rental-ai-auth";

// ---------------------------------------------------------------------------
// Streaming helper for rental_ai_chat when stream: true
// Consumes the internal SSE and returns the final accumulated content + headers
// ---------------------------------------------------------------------------

async function callRentalChatStreaming(
  body: any,
  authHeader: string
): Promise<{ content: string; used?: string; remaining?: string }> {
  const origin = process.env.INTERNAL_SELF_ORIGIN || "http://localhost:3000";

  const res = await fetch(`${origin}/api/ai/rent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    return { content: `Streaming chat failed: ${res.status} ${text}` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalContent = "";
  let used = res.headers.get("x-rental-tokens-used") || undefined;
  let remaining = res.headers.get("x-rental-tokens-remaining") || undefined;

  // Accumulate deltas from OpenAI-style chat.completion.chunk events
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        // Try to pick up final metering headers if they were sent late
        // (some responses send them on the final chunk or trailers)
        break;
      }

      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) finalContent += delta;
      } catch {
        // ignore partial JSON
      }
    }
  }

  // Fallback: if we didn't get content via deltas, the backend may have sent
  // the full response in one go even on stream=true for some paths.
  if (!finalContent && res.headers.get("content-type")?.includes("application/json")) {
    // rare fallback
  }

  return { content: finalContent, used, remaining };
}

// ---------------------------------------------------------------------------
// Tool Definitions (kept in sync with the public handoff + OpenAPI)
// ---------------------------------------------------------------------------

export const tools: Tool[] = [
  {
    name: "rental_ai_chat",
    description:
      "Send a natural language question to the tenant-scoped Rental AI advisor. " +
      "Returns markdown analysis with options-aware context and the tenant strategyBias injected. " +
      "Supports streaming. IMPORTANT: outputs are educational only and NOT personalized financial advice.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The user question or instruction" },
        portfolioId: {
          type: "string",
          description: "Optional 24-hex Mongo portfolio id to scope context",
        },
        stream: {
          type: "boolean",
          description: "If true, returns SSE-style deltas (recommended for UX)",
          default: false,
        },
      },
      required: ["message"],
    },
  },
  {
    name: "rental_ai_create_strategy",
    description:
      "Start an async options strategy materialization job for the given symbols. " +
      "Returns a jobId immediately. Poll with rental_ai_get_strategy.",
    inputSchema: {
      type: "object",
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          description: 'e.g. ["NVDA", "SPY", "TSLA"]',
        },
        notes: {
          type: "string",
          description: 'Free-text bias or constraints (e.g. "conservative income only")',
        },
        portfolioId: {
          type: "string",
          description: "Optional owned portfolio to enrich context",
        },
      },
      required: ["symbols"],
    },
  },
  {
    name: "rental_ai_get_strategy",
    description: "Poll a previously created strategy job. Returns status + result when completed.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The jobId returned from rental_ai_create_strategy" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "rental_ai_create_analyze",
    description: "Kick off (or continue) a deep portfolio/position analysis. Returns jobId.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Optional existing jobId to extend" },
        deepRun: { type: "boolean", description: "Run deeper / more expensive analysis", default: false },
      },
    },
  },
  {
    name: "rental_ai_get_analyze",
    description: "Poll an analyze job. Returns status + narrative or structured result.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
    },
  },
];

// ---------------------------------------------------------------------------
// Helper: Call the existing internal Rental AI HTTP endpoints
// (this reuses all auth, guardrails, jobs, metering, audit, personas, etc.)
// ---------------------------------------------------------------------------

async function callRentalEndpoint(
  path: string,
  method: string,
  body: unknown,
  authHeader: string | null
) {
  const origin = process.env.INTERNAL_SELF_ORIGIN || "http://localhost:3000";

  const res = await fetch(`${origin}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data,
  };
}

// ---------------------------------------------------------------------------
// Per-request MCP handler (recommended for multi-tenant auth)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Web-native MCP handler (compatible with Next.js)
// We use the SDK Server for tool definitions + dispatching, but handle the
// HTTP/JSON-RPC layer ourselves because the official transport expects raw Node http.
// ---------------------------------------------------------------------------

async function handleMcpJsonRpc(body: any, authHeader: string) {
  const { jsonrpc, id, method, params } = body || {};

  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id: id ?? null, error: { code: -32600, message: "Invalid Request" } };
  }

  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "rental-ai-native-mcp", version: "1.0.0" },
        },
      };
    }

    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools } };
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments ?? {};

      // Reuse the same logic we had before
      let result;
      switch (toolName) {
        case "rental_ai_chat": {
          const wantsStream = !!(args as any).stream;

          if (wantsStream) {
            // Improved streaming path: consume internal SSE and return final content
            const streamResult = await callRentalChatStreaming(args, authHeader);
            const meta = streamResult.used
              ? `\n\n---\nTokens used: ${streamResult.used} | remaining: ${streamResult.remaining ?? "?"} (UTC day)`
              : "";
            result = { content: [{ type: "text", text: (streamResult.content || "") + meta }] };
          } else {
            // Fast path - non-streaming JSON
            const res = await callRentalEndpoint("/api/ai/rent/chat", "POST", args, authHeader);
            if (res.status >= 400) {
              result = { content: [{ type: "text", text: `Error: ${JSON.stringify(res.data)}` }], isError: true };
            } else {
              const used = res.headers["x-rental-tokens-used"];
              const remaining = res.headers["x-rental-tokens-remaining"];
              const meta = used ? `\n\n---\nTokens used: ${used} | remaining: ${remaining} (UTC day)` : "";
              result = { content: [{ type: "text", text: (res.data?.data?.response || "") + meta }] };
            }
          }
          break;
        }

        case "rental_ai_create_strategy": {
          const res = await callRentalEndpoint("/api/ai/rent/strategy", "POST", args, authHeader);
          if (res.status >= 400) {
            result = { content: [{ type: "text", text: `Error: ${JSON.stringify(res.data)}` }], isError: true };
          } else {
            result = { content: [{ type: "text", text: `Strategy job created. jobId: ${res.data.jobId}` }] };
          }
          break;
        }

        case "rental_ai_get_strategy":
        case "rental_ai_get_analyze": {
          const jobId = args.jobId;
          const path = toolName === "rental_ai_get_strategy"
            ? `/api/ai/rent/strategy?jobId=${jobId}`
            : `/api/ai/rent/analyze?jobId=${jobId}`;
          const res = await callRentalEndpoint(path, "GET", null, authHeader);
          if (res.status >= 400) {
            result = { content: [{ type: "text", text: `Error: ${JSON.stringify(res.data)}` }], isError: true };
          } else {
            result = { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
          }
          break;
        }

        case "rental_ai_create_analyze": {
          const res = await callRentalEndpoint("/api/ai/rent/analyze", "POST", args, authHeader);
          if (res.status >= 400) {
            result = { content: [{ type: "text", text: `Error: ${JSON.stringify(res.data)}` }], isError: true };
          } else {
            result = { content: [{ type: "text", text: `Analyze job created. jobId: ${res.data.jobId}` }] };
          }
          break;
        }

        default:
          result = { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true };
      }

      return { jsonrpc: "2.0", id, result };
    }

    return { jsonrpc: "2.0", id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (err: any) {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32603, message: err.message || "Internal error" },
    };
  }
}

async function handleMcpRequest(request: Request, authHeader: string) {
  const contentType = request.headers.get("content-type") || "";
  let body: any = null;

  if (request.method === "POST" && contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }
  }

  const jsonRpcResponse = await handleMcpJsonRpc(body, authHeader);

  return new Response(JSON.stringify(jsonRpcResponse), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer atxr_")) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        message: "A valid atxr_* rental API key is required in the Authorization header.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    return await handleMcpRequest(request, authHeader);
  } catch (err) {
    console.error("[/mcp] POST error", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  // Nice discovery / info response (works even without a key)
  if (!authHeader?.startsWith("Bearer atxr_")) {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "Rental AI Native MCP Server",
        version: "1.0.0",
        endpoint: "/mcp",
        discovery: "https://fintech-advisor.ai/mcp/discovery",
        description:
          "Native MCP endpoint for the aTx Finance Rental AI (white-label). " +
          "Point Grok or other agents here with your atxr_* rental key for self-onboarding.",
        tools: tools.map((t) => t.name),
        streaming_chat: "Pass { stream: true } to rental_ai_chat for SSE-backed responses",
        docs: "https://fintech-advisor.ai",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Authenticated GET (some clients use this for SSE initialization)
  try {
    // For simple clients we can return the same info or an empty success
    return new Response(
      JSON.stringify({ ok: true, session: "supported-via-post" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[/mcp] GET error", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "X-MCP-Server": "rental-ai-native",
      "X-MCP-Version": "1.0.0",
      "X-MCP-Path": "/mcp",
    },
  });
}
