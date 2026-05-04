import { ObjectId, type Db } from "mongodb";

import { getDb } from "@/lib/mongodb";

export const XCHAT_USER_PROMPT_TEMPLATES_COLLECTION = "xchat_user_prompt_templates";

const MAX_TEMPLATES_PER_USER = 40;
const TITLE_MAX = 80;
const SUBTITLE_MAX = 120;
const PROMPT_MAX = 4000;

export type XchatUserPromptTemplateDoc = {
  _id: ObjectId;
  userId: ObjectId;
  tenantId: ObjectId | null;
  title: string;
  subtitle: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
};

export type XchatUserPromptTemplatePublic = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  updatedAt: string;
};

function sanitizeTitleSubtitlePrompt(input: {
  title: string;
  subtitle?: string;
  prompt: string;
}): { ok: true; title: string; subtitle: string; prompt: string } | { ok: false; error: string } {
  const title = input.title.trim().slice(0, TITLE_MAX);
  const subtitle = (input.subtitle ?? "").trim().slice(0, SUBTITLE_MAX);
  const prompt = input.prompt.trim().slice(0, PROMPT_MAX);
  if (title.length < 1) {
    return { ok: false, error: "Title is required" };
  }
  if (prompt.length < 1) {
    return { ok: false, error: "Prompt is required" };
  }
  return { ok: true, title, subtitle, prompt };
}

export async function countUserPromptTemplates(db: Db, userId: ObjectId): Promise<number> {
  return db.collection(XCHAT_USER_PROMPT_TEMPLATES_COLLECTION).countDocuments({ userId });
}

export async function listUserPromptTemplates(
  db: Db,
  userId: ObjectId
): Promise<XchatUserPromptTemplatePublic[]> {
  const rows = await db
    .collection<XchatUserPromptTemplateDoc>(XCHAT_USER_PROMPT_TEMPLATES_COLLECTION)
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(MAX_TEMPLATES_PER_USER)
    .toArray();
  return rows.map((r) => ({
    id: r._id.toHexString(),
    title: r.title,
    subtitle: r.subtitle,
    prompt: r.prompt,
    updatedAt: r.updatedAt.toISOString()
  }));
}

export async function insertUserPromptTemplate(input: {
  userId: ObjectId;
  tenantId: ObjectId | null;
  title: string;
  subtitle?: string;
  prompt: string;
}): Promise<
  | { ok: true; template: XchatUserPromptTemplatePublic }
  | { ok: false; status: number; error: string; code?: string }
> {
  const cleaned = sanitizeTitleSubtitlePrompt(input);
  if (!cleaned.ok) {
    return { ok: false, status: 400, error: cleaned.error, code: "validation_error" };
  }

  const db = await getDb();
  const n = await countUserPromptTemplates(db, input.userId);
  if (n >= MAX_TEMPLATES_PER_USER) {
    return {
      ok: false,
      status: 400,
      error: `You can save at most ${MAX_TEMPLATES_PER_USER} custom templates.`,
      code: "xchat_user_templates_limit"
    };
  }

  const now = new Date();
  const doc: Omit<XchatUserPromptTemplateDoc, "_id"> = {
    userId: input.userId,
    tenantId: input.tenantId,
    title: cleaned.title,
    subtitle: cleaned.subtitle,
    prompt: cleaned.prompt,
    createdAt: now,
    updatedAt: now
  };
  const { insertedId } = await db
    .collection<Omit<XchatUserPromptTemplateDoc, "_id">>(XCHAT_USER_PROMPT_TEMPLATES_COLLECTION)
    .insertOne(doc);

  return {
    ok: true,
    template: {
      id: insertedId.toHexString(),
      title: cleaned.title,
      subtitle: cleaned.subtitle,
      prompt: cleaned.prompt,
      updatedAt: now.toISOString()
    }
  };
}

export async function deleteUserPromptTemplate(input: {
  userId: ObjectId;
  templateId: ObjectId;
}): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection(XCHAT_USER_PROMPT_TEMPLATES_COLLECTION).deleteOne({
    _id: input.templateId,
    userId: input.userId
  });
  return res.deletedCount === 1;
}
