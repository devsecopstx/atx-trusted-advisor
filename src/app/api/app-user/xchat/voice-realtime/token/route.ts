import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { WORKSPACE_PORTFOLIO_COOKIE_NAME } from "@/lib/workspace-portfolio-cookie";
import { buildXaiRealtimeWsUrl, createXaiRealtimeClientSecret } from "@/lib/xai-voice-realtime";
import type { XaiVoiceRealtimeModelId } from "@/modules/xchat/voice/types";
import { buildWorkspaceServerSnapshotBlock } from "@/modules/xchat/workspace-snapshot-for-prompt";

const MAX_VOICE_WORKSPACE_CONTEXT_CHARS = 12_000;

const bodySchema = z
  .object({
    model: z.enum(["grok-voice-think-fast-1.0", "grok-voice-fast-1.0"]).optional(),
    expiresAfterSeconds: z.number().int().min(60).max(3600).optional()
  })
  .optional();

const DEFAULT_MODEL: XaiVoiceRealtimeModelId = "grok-voice-think-fast-1.0";

/**
 * Mint xAI Voice Agent ephemeral client secret for browser WebSocket (`wss://…/v1/realtime`).
 * Never returns the platform API key.
 */
export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const raw =
      request.headers.get("content-type")?.includes("application/json") && request.body
        ? await request.json()
        : undefined;
    parsedBody = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const model = parsedBody?.model ?? DEFAULT_MODEL;
  const expiresAfterSeconds = parsedBody?.expiresAfterSeconds ?? 600;

  let workspace_voice_context: string | null = null;
  try {
    const jar = await cookies();
    const rawPid = jar.get(WORKSPACE_PORTFOLIO_COOKIE_NAME)?.value?.trim();
    const workspacePortfolioId =
      rawPid && ObjectId.isValid(rawPid) ? rawPid : undefined;
    const block = await buildWorkspaceServerSnapshotBlock({
      userId: session.userId,
      tenantId: session.tenantId,
      workspacePortfolioId
    });
    const trimmed = block?.trim() ?? "";
    if (trimmed.length > 0) {
      workspace_voice_context =
        trimmed.length > MAX_VOICE_WORKSPACE_CONTEXT_CHARS
          ? `${trimmed.slice(0, MAX_VOICE_WORKSPACE_CONTEXT_CHARS)}\n\n[truncated for voice session]`
          : trimmed;
    }
  } catch (err) {
    console.warn("[xchat/voice-realtime/token] workspace_voice_context omitted", {
      message: err instanceof Error ? err.message : String(err)
    });
  }

  try {
    const client_secret = await createXaiRealtimeClientSecret({
      expiresSeconds: expiresAfterSeconds,
      model
    });
    const realtime_ws_url = buildXaiRealtimeWsUrl(model);
    return NextResponse.json({
      data: {
        client_secret,
        realtime_ws_url,
        model,
        ...(workspace_voice_context ? { workspace_voice_context } : {})
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token_failed";
    console.warn("[xchat/voice-realtime/token]", msg);
    return NextResponse.json(
      { error: "Voice session unavailable", code: "xai_realtime_token_failed" },
      { status: 503 }
    );
  }
}
