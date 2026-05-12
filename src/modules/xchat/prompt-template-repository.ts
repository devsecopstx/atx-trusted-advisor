import type { Collection, Db } from "mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";

import type { HnwiPromptTemplateV21Slug } from "@/modules/xchat/prompt-templates-v21-defaults";

export const PROMPT_TEMPLATES_COLLECTION = "prompt_templates";

const promptTemplateRowSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  slug: z.string().min(1),
  version: z.string().min(1),
  tenantId: z.instanceof(ObjectId).nullable().optional(),
  prompt_text: z.string().min(1),
  output_schema: z.string().optional(),
  active: z.boolean(),
  bias_defaults: z.record(z.string(), z.unknown()).optional(),
  updatedAt: z.date().optional(),
  createdAt: z.date().optional()
});

export type PromptTemplateRow = z.infer<typeof promptTemplateRowSchema>;

function parsePromptTemplateDoc(raw: unknown): PromptTemplateRow | null {
  const parsed = promptTemplateRowSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function findActivePromptTemplateForTenant(
  db: Db,
  slug: HnwiPromptTemplateV21Slug,
  tenantIdHex: string | undefined
): Promise<PromptTemplateRow | null> {
  const coll: Collection = db.collection(PROMPT_TEMPLATES_COLLECTION);
  if (tenantIdHex && ObjectId.isValid(tenantIdHex)) {
    const tenantRow = await coll.findOne({
      slug,
      active: true,
      tenantId: new ObjectId(tenantIdHex)
    });
    const tenantParsed = tenantRow ? parsePromptTemplateDoc(tenantRow) : null;
    if (tenantParsed) {
      return tenantParsed;
    }
  }
  const globalRow = await coll.findOne({
    slug,
    active: true,
    tenantId: null
  });
  return globalRow ? parsePromptTemplateDoc(globalRow) : null;
}
