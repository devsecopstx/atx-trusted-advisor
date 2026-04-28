import { Buffer } from "node:buffer";

import type { ScheduledTask } from "@/modules/core-admin/types";
import { renderMarketingPost } from "@/modules/marketing/render";
import { getMarketingTemplateById } from "@/modules/marketing/repository";
import type { MarketingPlatform, MarketingTaskConfig } from "@/modules/marketing/types";

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
  const token = await getXOAuthAccessTokenForPosting();
  if (!token) {
    throw new Error("Missing X OAuth credentials (set X_OAUTH_REFRESH_TOKEN with X_OAUTH_CLIENT_ID/X_OAUTH_CLIENT_SECRET)");
  }
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`X API error (${response.status}): ${body.slice(0, 240)}`);
  }
}

type XOAuthTokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let xOAuthTokenCache: XOAuthTokenCache | null = null;
const X_OAUTH_TOKEN_REFRESH_SAFETY_WINDOW_MS = 60_000;

function getXOAuthTokenUrl(): string {
  const configured = process.env.X_OAUTH_TOKEN_URL?.trim();
  return configured && configured.length > 0 ? configured : "https://api.x.com/2/oauth2/token";
}

async function getXOAuthAccessTokenForPosting(): Promise<string | null> {
  const now = Date.now();
  if (
    xOAuthTokenCache &&
    xOAuthTokenCache.accessToken &&
    xOAuthTokenCache.expiresAtMs - X_OAUTH_TOKEN_REFRESH_SAFETY_WINDOW_MS > now
  ) {
    return xOAuthTokenCache.accessToken;
  }

  const clientId = process.env.X_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.X_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const tokenUrl = getXOAuthTokenUrl();
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string; error_description?: string }
    | null;
  if (!response.ok) {
    const reason = payload?.error_description ?? payload?.error ?? `status ${response.status}`;
    throw new Error(`X OAuth token refresh failed: ${reason}`);
  }
  const accessToken = payload?.access_token?.trim();
  if (!accessToken) {
    throw new Error("X OAuth token refresh returned no access_token");
  }
  const expiresInSec =
    typeof payload?.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? Math.max(60, Math.floor(payload.expires_in))
      : 3600;
  xOAuthTokenCache = {
    accessToken,
    expiresAtMs: now + expiresInSec * 1000
  };
  return accessToken;
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
  const { postText } = renderMarketingPost({
    sourceContent,
    config,
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
