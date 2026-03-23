import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { buildUserFeedbackNotification, sendSlackNotification } from "@/lib/slack";

const bodySchema = z.object({
  message: z.string().trim().min(3).max(4000),
  page: z.string().trim().max(500).optional()
});

export async function POST(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  void sendSlackNotification(
    buildUserFeedbackNotification({
      message: parsed.data.message,
      email: session.email,
      username: session.username,
      userId: session.userId,
      page: parsed.data.page
    })
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
