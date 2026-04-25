import { NextResponse } from "next/server";
import { z } from "zod";

import {
    completeEmailVerification
} from "@/modules/identity/email-credentials-repository";
import { sendWelcomeEmailIfConfigured } from "@/modules/identity/email-welcome";
import { getCoreUserById } from "@/modules/identity/repository";

const bodySchema = z.object({
  token: z.string().trim().min(20).max(512)
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const result = await completeEmailVerification({ rawToken: parsed.data.token });
  if (!result.ok) {
    const status = result.code === "already_verified" ? 409 : 400;
    return NextResponse.json({ error: result.code }, { status });
  }
  const user = await getCoreUserById(result.userId);
  if (user) {
    await sendWelcomeEmailIfConfigured(user);
  }
  return NextResponse.json({ ok: true });
}
