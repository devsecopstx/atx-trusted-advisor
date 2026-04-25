import { NextResponse } from "next/server";
import { z } from "zod";

import { issueEmailVerificationForUser } from "@/modules/identity/email-credentials-repository";
import { getCoreUserByEmail } from "@/modules/identity/repository";

const bodySchema = z.object({
  email: z.string().trim().email()
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
  const email = parsed.data.email.toLowerCase();
  const user = await getCoreUserByEmail(email);
  if (user?._id) {
    await issueEmailVerificationForUser(user._id);
  }
  // Privacy-safe response regardless of account existence.
  return NextResponse.json({ ok: true });
}
