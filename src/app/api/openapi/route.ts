import { NextResponse } from "next/server";

import { buildCurrentStateOpenApi } from "@/lib/openapi/current-state";

export async function GET() {
  const document = buildCurrentStateOpenApi();

  return NextResponse.json(document, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
