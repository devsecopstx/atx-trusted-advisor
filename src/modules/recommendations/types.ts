import type { ObjectId } from "mongodb";

export const recommendationStatusValues = [
  "draft",
  "active",
  "dismissed",
  "superseded"
] as const;
export type RecommendationStatus = (typeof recommendationStatusValues)[number];

export const recommendationSourceValues = ["user", "system", "agent"] as const;
export type RecommendationSource = (typeof recommendationSourceValues)[number];

export type RecommendationPayload = Record<string, unknown>;

export type Recommendation = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  userId: string;
  title: string;
  /** Short text; optional when only payload is used */
  summary?: string;
  /** Agent/subscriber filter hints (e.g. symbols, strategy ids) */
  scopeTags: string[];
  payload: RecommendationPayload;
  status: RecommendationStatus;
  source: RecommendationSource;
  createdAt: Date;
  updatedAt: Date;
};
