import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { parseXfUiThemePreferenceFromUnknown } from "@/lib/xf-ui-theme";
import {
    getCoreUserXfUiThemePreferenceForHex,
    updateCoreUserXfUiThemePreference
} from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  xfUiTheme: z.enum(["light", "dark", "system"])
});

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const stored = await getCoreUserXfUiThemePreferenceForHex(session.userId);
  return NextResponse.json({
    data: { xfUiTheme: stored ?? null }
  });
}

export async function PATCH(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const theme = parseXfUiThemePreferenceFromUnknown(parsed.data.xfUiTheme);
  if (theme === undefined) {
    return NextResponse.json({ error: "Invalid xfUiTheme" }, { status: 400 });
  }
  const ok = await updateCoreUserXfUiThemePreference(session.userId, theme);
  if (!ok) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { xfUiTheme: theme } });
}
