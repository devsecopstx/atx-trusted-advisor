import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { MAX_FINRA_EVIDENCE_BYTES } from "@/modules/compliance/finra-evidence-upload";
import {
    finraRegistrationFieldsSchema,
    readFinraEvidenceFilesFromForm
} from "@/modules/compliance/finra-registration-schema";
import {
    createFinraRegistration,
    listFinraRegistrationsForAdvisor,
    serializeFinraRegistration
} from "@/modules/compliance/repository";
import { isAdvisorPlatformRole } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

function errorStatus(error: string): number {
  if (error === "invalid_scope" || error === "invalid_request") {
    return 400;
  }
  if (
    error === "evidence_file_too_large" ||
    error === "evidence_upload_failed" ||
    error === "user_xchat_history_collection_unavailable"
  ) {
    return 502;
  }
  return 400;
}

function invalidRequestResponse(details?: string[]) {
  return NextResponse.json(
    {
      error: "invalid_request",
      ...(details && details.length > 0 ? { details } : {})
    },
    { status: 400 }
  );
}

async function parseFinraRegistrationRequest(request: Request): Promise<
  | {
      ok: true;
      body: Record<string, unknown>;
      evidenceFiles: Array<{ filename: string; mimeType: string; bytes: Uint8Array }>;
    }
  | { ok: false; response: NextResponse }
> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_FINRA_EVIDENCE_BYTES * 8 + 8_192) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Payload too large" }, { status: 413 })
      };
    }
    const form = await request.formData();
    const parsedFields = finraRegistrationFieldsSchema.safeParse({
      crdNumber: String(form.get("crdNumber") ?? ""),
      licenseType: String(form.get("licenseType") ?? ""),
      jurisdiction: String(form.get("jurisdiction") ?? ""),
      evidenceUrl: form.get("evidenceUrl") ?? "",
      notes: form.get("notes") ?? "",
      status: form.get("status") ? String(form.get("status")) : undefined
    });
    if (!parsedFields.success) {
      return {
        ok: false,
        response: invalidRequestResponse(parsedFields.error.issues.map((issue) => issue.message))
      };
    }
    const evidenceFilesResult = await readFinraEvidenceFilesFromForm(form, MAX_FINRA_EVIDENCE_BYTES);
    if ("error" in evidenceFilesResult) {
      return {
        ok: false,
        response: NextResponse.json({ error: evidenceFilesResult.error }, { status: 413 })
      };
    }
    return {
      ok: true,
      body: parsedFields.data,
      evidenceFiles: evidenceFilesResult
    };
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: invalidRequestResponse()
    };
  }
  const parsedBody = finraRegistrationFieldsSchema.safeParse(body);
  if (!parsedBody.success) {
    return {
      ok: false,
      response: invalidRequestResponse(parsedBody.error.issues.map((issue) => issue.message))
    };
  }
  return { ok: true, body: parsedBody.data, evidenceFiles: [] };
}

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isAdvisorPlatformRole(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listFinraRegistrationsForAdvisor({
    tenantId: session.tenantId,
    advisorUserId: session.userId
  });

  return NextResponse.json({
    data: rows.map(serializeFinraRegistration)
  });
}

export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!isAdvisorPlatformRole(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedRequest = await parseFinraRegistrationRequest(request);
  if (!parsedRequest.ok) {
    return parsedRequest.response;
  }

  const result = await createFinraRegistration({
    tenantId: session.tenantId,
    advisorUserId: session.userId,
    email: session.email,
    body: parsedRequest.body,
    evidenceFiles: parsedRequest.evidenceFiles
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: serializeFinraRegistration(result.registration) }, { status: 201 });
}
