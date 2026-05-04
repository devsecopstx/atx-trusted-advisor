import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";
import {
    insertUserPromptTemplate,
    listUserPromptTemplates
} from "@/modules/xchat/xchat-user-prompt-templates-repository";

const postBodySchema = z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().max(120).optional(),
  prompt: z.string().min(1).max(4000)
});

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }
  const db = await getDb();
  const templates = await listUserPromptTemplates(db, new ObjectId(session.userId));
  return NextResponse.json({ data: { templates } });
}

export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!ObjectId.isValid(session.userId)) {
    return NextResponse.json({ error: "Invalid session user" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid template payload", code: "validation_error" },
      { status: 400 }
    );
  }

  const tenantId =
    session.tenantId && ObjectId.isValid(session.tenantId)
      ? new ObjectId(session.tenantId)
      : null;

  const result = await insertUserPromptTemplate({
    userId: new ObjectId(session.userId),
    tenantId,
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    prompt: parsed.data.prompt
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({ data: { template: result.template } }, { status: 201 });
}
