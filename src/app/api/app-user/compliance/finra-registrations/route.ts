import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { MAX_FINRA_EVIDENCE_BYTES } from "@/modules/compliance/finra-evidence-upload";
import {
    createFinraRegistration,
    listFinraRegistrationsForAdvisor,
    serializeFinraRegistration
} from "@/modules/compliance/repository";
import { advisorFinraRegistrationStatusValues, advisorLicenseTypeValues } from "@/modules/compliance/types";
import { isAdvisorPlatformRole } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

const finraFieldsSchema = z.object({
  crdNumber: z.string().trim().min(1).max(32),
  licenseType: z.enum(advisorLicenseTypeValues),
  jurisdiction: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{2}$/.test(v), "Invalid jurisdiction"),
  evidenceUrl: z
    .string()
    .trim()
    .url()
    .max(2048)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  status: z.enum(advisorFinraRegistrationStatusValues).optional()
});

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

async function parseFinraRegistrationRequest(request: Request): Promise<
  | {
      ok: true;
      body: Record<string, unknown>;
      evidenceFile?: { filename: string; mimeType: string; bytes: Uint8Array };
    }
  | { ok: false; response: NextResponse }
> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_FINRA_EVIDENCE_BYTES + 8_192) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Payload too large" }, { status: 413 })
      };
    }
    const form = await request.formData();
    const file = form.get("evidenceFile");
    const parsedFields = finraFieldsSchema.safeParse({
      crdNumber: String(form.get("crdNumber") ?? ""),
      licenseType: String(form.get("licenseType") ?? ""),
      jurisdiction: String(form.get("jurisdiction") ?? ""),
      evidenceUrl: String(form.get("evidenceUrl") ?? ""),
      notes: String(form.get("notes") ?? ""),
      status: form.get("status") ? String(form.get("status")) : undefined
    });
    if (!parsedFields.success) {
      return {
        ok: false,
        response: NextResponse.json({ error: "invalid_request" }, { status: 400 })
      };
    }
    let evidenceFile: { filename: string; mimeType: string; bytes: Uint8Array } | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FINRA_EVIDENCE_BYTES) {
        return {
          ok: false,
          response: NextResponse.json({ error: "evidence_file_too_large" }, { status: 413 })
        };
      }
      const arrayBuffer = await file.arrayBuffer();
      evidenceFile = {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes: new Uint8Array(arrayBuffer)
      };
    }
    return {
      ok: true,
      body: {
        ...parsedFields.data,
        evidenceUrl: parsedFields.data.evidenceUrl ?? null,
        notes: parsedFields.data.notes ?? null
      },
      evidenceFile
    };
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_request" }, { status: 400 })
    };
  }
  return { ok: true, body: body as Record<string, unknown> };
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
    evidenceFile: parsedRequest.evidenceFile
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: errorStatus(result.error) });
  }

  return NextResponse.json({ data: serializeFinraRegistration(result.registration) }, { status: 201 });
}
