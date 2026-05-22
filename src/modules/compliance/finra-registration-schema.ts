import { z } from "zod";

import {
    advisorFinraRegistrationStatusValues,
    advisorLicenseTypeValues
} from "@/modules/compliance/types";

export function normalizeOptionalEvidenceUrl(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return trimmed.length <= 2048 ? trimmed : null;
  } catch {
    return null;
  }
}

export const finraRegistrationFieldsSchema = z.object({
  crdNumber: z.string().trim().min(1).max(32),
  licenseType: z.enum(advisorLicenseTypeValues),
  jurisdiction: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{2}$/.test(v), "Invalid jurisdiction"),
  evidenceUrl: z.preprocess(
    normalizeOptionalEvidenceUrl,
    z.union([z.string().url().max(2048), z.null()])
  ),
  notes: z.preprocess(
    (value) => {
      if (value == null) {
        return null;
      }
      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(2000).nullable()
  ),
  status: z.enum(advisorFinraRegistrationStatusValues).optional()
});

export const finraRegistrationBodySchema = finraRegistrationFieldsSchema;
export const finraRegistrationPatchSchema = finraRegistrationFieldsSchema.partial();

export type FinraRegistrationFields = z.infer<typeof finraRegistrationFieldsSchema>;

export type ParsedFinraEvidenceFile = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export async function readFinraEvidenceFilesFromForm(
  form: FormData,
  maxBytes: number
): Promise<ParsedFinraEvidenceFile[] | { error: "evidence_file_too_large" }> {
  const candidates = [...form.getAll("evidenceFiles"), form.get("evidenceFile")];
  const files: ParsedFinraEvidenceFile[] = [];
  for (const entry of candidates) {
    if (!(entry instanceof File) || entry.size <= 0) {
      continue;
    }
    if (entry.size > maxBytes) {
      return { error: "evidence_file_too_large" };
    }
    const arrayBuffer = await entry.arrayBuffer();
    files.push({
      filename: entry.name,
      mimeType: entry.type || "application/octet-stream",
      bytes: new Uint8Array(arrayBuffer)
    });
  }
  return files;
}
