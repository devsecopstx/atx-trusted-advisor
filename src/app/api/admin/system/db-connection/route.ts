import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getMongoConnectionLabel, getMongoUri } from "@/lib/env";
import { createAuditEvent } from "@/modules/audit/repository";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const uri = getMongoUri();
    const label = getMongoConnectionLabel();

    await createAuditEvent({
      entityType: "system",
      entityId: "db-connection",
      action: "db_connection_viewed",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        label: label // Log the sanitized label, not the full URI with credentials
      }
    });

    return NextResponse.json({
      connectionString: uri,
      connectionLabel: label
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve database connection information" },
      { status: 500 }
    );
  }
}