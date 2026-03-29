import { NextResponse } from "next/server";

import { APP_VERSION } from "@/lib/app-version";
import { getDb } from "@/lib/mongodb";
import { checkRedisHealth } from "@/lib/redis-client";

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
      redis
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
