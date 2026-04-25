import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";

const bodySchema = z.object({
  transcriptDraft: z.string().trim().min(1).max(4000),
  locale: z.string().trim().max(32).optional()
});

/**
 * MVP contract for voice input handoff.
 * Client can submit browser STT draft text here before `/api/xchat/ask`.
 */
export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const transcript = parsed.data.transcriptDraft.replace(/\s+/g, " ").trim();
  return NextResponse.json({
    data: {
      transcript,
      locale: parsed.data.locale ?? "en-US",
      source: "browser_stt_mvp"
    }
  });
}
