import type { Recommendation } from "@/modules/recommendations/types";

export type RecommendationJson = {
  _id: string;
  tenantId?: string;
  userId: string;
  title: string;
  summary?: string;
  scopeTags: string[];
  payload: Record<string, unknown>;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export function recommendationToJson(doc: Recommendation): RecommendationJson {
  const id = doc._id?.toHexString();
  if (!id) {
    throw new Error("Recommendation missing _id");
  }
  return {
    _id: id,
    ...(doc.tenantId ? { tenantId: doc.tenantId.toHexString() } : {}),
    userId: doc.userId,
    title: doc.title,
    ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
    scopeTags: doc.scopeTags,
    payload: doc.payload,
    status: doc.status,
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}
