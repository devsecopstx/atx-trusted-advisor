import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { publishMarketingTextToX } from "@/modules/marketing/publisher";

const testPostXSchema = z.object({
  postText: z.string().trim().min(1).max(8000)
});

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = testPostXSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    await publishMarketingTextToX(parsed.data.postText);
    return NextResponse.json({
      data: {
        posted: true,
        platform: "x"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post to X";
    if (message.includes("Missing X OAuth for posting")) {
      return NextResponse.json(
        {
          error:
            "X OAuth is not configured for posting. Use Admin → Marketing → Connect X for posting, or set legacy X_OAUTH_REFRESH_TOKEN with X_OAUTH_CLIENT_ID / X_OAUTH_CLIENT_SECRET."
        },
        { status: 400 }
      );
    }
    if (message.includes("X OAuth token refresh failed")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    if (message.includes("X API error")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    throw error;
  }
}
