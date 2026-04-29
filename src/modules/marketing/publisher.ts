import type { ScheduledTask } from "@/modules/core-admin/types";
import { interpolateMarketingTemplate, renderMarketingPost } from "@/modules/marketing/render";
import { getMarketingTemplateById } from "@/modules/marketing/repository";
import type { MarketingPlatform, MarketingTaskConfig } from "@/modules/marketing/types";
import {
    clearXOAuthPostingMemoryCache,
    postMarketingTweetWithRetries
} from "@/modules/marketing/x-posting-token-manager";
import { generateMarketingMarkdownWithXchat } from "@/modules/marketing/xchat-markdown";

export { clearXOAuthPostingMemoryCache };

type PublishResult = {
  platform: MarketingPlatform;
  ok: boolean;
  message: string;
};

function normalizeConfig(task: ScheduledTask): MarketingTaskConfig {
  const config = task.config;
  if (!config) {
    throw new Error("Missing marketing config");
  }
  if (!Array.isArray(config.platforms) || config.platforms.length === 0) {
    throw new Error("At least one platform is required");
  }
  if (!config.destinationUrl || config.destinationUrl.trim().length === 0) {
    throw new Error("Destination URL is required");
  }
  return config;
}

async function postToX(text: string): Promise<void> {
  await postMarketingTweetWithRetries(text);
}

export async function publishMarketingTextToX(text: string): Promise<void> {
  const body = text.trim();
  if (!body) {
    throw new Error("Post text is required");
  }
  await postToX(body);
}

async function postToLinkedIn(text: string): Promise<void> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const organizationUrn = process.env.LINKEDIN_ORGANIZATION_URN?.trim();
  if (!token || !organizationUrn) {
    throw new Error("Missing LINKEDIN_ACCESS_TOKEN or LINKEDIN_ORGANIZATION_URN");
  }
  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify({
      author: organizationUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LinkedIn API error (${response.status}): ${body.slice(0, 240)}`);
  }
}

async function publishToPlatform(platform: MarketingPlatform, text: string): Promise<PublishResult> {
  try {
    if (platform === "x") {
      await postToX(text);
    } else {
      await postToLinkedIn(text);
    }
    return { platform, ok: true, message: "posted" };
  } catch (error) {
    return {
      platform,
      ok: false,
      message: error instanceof Error ? error.message : "unknown publishing error"
    };
  }
}

export async function runMarketingPostTask(task: ScheduledTask): Promise<{ status: "success" | "failed"; output: string }> {
  const config = normalizeConfig(task);
  const now = new Date();
  const template = config.templateId ? await getMarketingTemplateById(config.templateId) : null;
  const sourceContent = config.customContent?.trim() || template?.contentTemplate?.trim();
  if (!sourceContent) {
    return { status: "failed", output: "marketing_post failed: no template or custom content configured" };
  }

  const interpolated = interpolateMarketingTemplate(sourceContent, now);
  let generatedMarkdown: string | undefined;
  const genPrompt = config.generationPrompt?.trim();
  if (genPrompt && genPrompt.length > 0) {
    try {
      const gen = await generateMarketingMarkdownWithXchat({
        roles: ["global_admin"],
        sourceContent: interpolated,
        generationPrompt: genPrompt,
        destinationUrl: config.destinationUrl,
        platforms: config.platforms
      });
      generatedMarkdown = gen.markdown;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "xChat generation failed";
      return { status: "failed", output: `marketing_post failed: ${msg}` };
    }
  }

  const { postText } = renderMarketingPost({
    sourceContent: interpolated,
    config,
    generatedMarkdown,
    now
  });

  const platformResults = await Promise.all(config.platforms.map((platform) => publishToPlatform(platform, postText)));
  const failed = platformResults.filter((result) => !result.ok);
  const summary = platformResults
    .map((result) => `${result.platform}:${result.ok ? "ok" : "failed"}${result.ok ? "" : `(${result.message})`}`)
    .join(", ");

  return {
    status: failed.length === 0 ? "success" : "failed",
    output: `marketing_post ${failed.length === 0 ? "succeeded" : "failed"} for task="${task.name}" platforms=[${summary}]`
  };
}
