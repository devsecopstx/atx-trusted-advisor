import { ObjectId } from "mongodb";

export const MARKETING_PLATFORMS = ["x", "linkedin"] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export type MarketingUtmParams = {
  utm_source: string;
  utm_campaign: string;
  utm_medium?: string;
  utm_content?: string;
  utm_term?: string;
};

export type MarketingPostTemplate = {
  _id?: ObjectId;
  slug: string;
  name: string;
  platforms: MarketingPlatform[];
  contentTemplate: string;
  defaultUtm: MarketingUtmParams;
  disclaimerMode: "required";
  estimatedEngagement?: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;
};

export type MarketingTaskConfig = {
  templateId?: string;
  customContent?: string;
  generationPrompt?: string;
  platforms: MarketingPlatform[];
  destinationUrl: string;
  utmParams: MarketingUtmParams;
  imageUrl?: string;
};

export type MarketingPostHistoryRow = {
  taskRunId: string;
  taskId: string;
  taskName: string;
  status: "running" | "success" | "failed";
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output: string;
};
