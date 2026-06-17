import { NextResponse } from "next/server";

import { APP_VERSION } from "@/lib/app-version";
import { getDb } from "@/lib/mongodb";
import { checkRedisHealth } from "@/lib/redis-client";

/** Safe ops fingerprint — last 2 chars only; confirms Cloud Run mounted the expected GSM version. */
function xaiChatKeyRuntimeFingerprint(): { configured: boolean; suffix: string | null } {
  const raw = process.env.XAI_API_KEY?.trim() ?? "";
  return {
    configured: raw.length > 0,
    suffix: raw.length >= 2 ? raw.slice(-2) : null
  };
}

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const redis = await checkRedisHealth();

    return NextResponse.json({
      status: "ok",
      service: "atxfinance-core-app",
      version: APP_VERSION,
      db: db.databaseName,
      redis,
      xaiChatKey: xaiChatKeyRuntimeFingerprint()
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
