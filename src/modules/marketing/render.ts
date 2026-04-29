import { withUtmParams } from "@/lib/marketing/utm";
import type { MarketingTaskConfig } from "@/modules/marketing/types";

/** Text-only; tracked landing URL is appended separately after the body (see `renderMarketingPost`). */
export const MANDATORY_MARKETING_DISCLAIMER =
  "Educational conversations only. Not personalized investment advice.";

function normalizedHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

/**
 * Drops whole lines that are only URLs to the same host as `destinationUrl`, so xChat output
 * does not duplicate the appended UTM link (model often echoes the bare domain).
 */
export function stripStandaloneDuplicateDestinationUrls(body: string, destinationUrl: string): string {
  let targetHost: string;
  try {
    targetHost = normalizedHostname(new URL(destinationUrl.trim()).hostname);
  } catch {
    return body.trimEnd();
  }

  const lines = body.split("\n");
  const kept = lines.filter((line) => {
    const t = line.trim();
    if (t.length === 0) {
      return true;
    }
    try {
      const url = new URL(t);
      const lineHost = normalizedHostname(url.hostname);
      if (lineHost === targetHost) {
        return false;
      }
    } catch {
      /* not a bare URL line */
    }
    return true;
  });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function formatMarketingTemplateDate(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/Chicago"
  }).format(now);
}

export function formatMarketingTemplateDayName(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/Chicago"
  }).format(now);
}

export function interpolateMarketingTemplate(template: string, now: Date): string {
  const date = formatMarketingTemplateDate(now);
  const dayName = formatMarketingTemplateDayName(now);
  return template
    .replaceAll("{{date}}", date)
    .replaceAll("{{day_name}}", dayName)
    .replaceAll("{{market_pulse}}", "focus on liquid, defined-risk options structures")
    .replaceAll("{date}", date)
    .replaceAll("{day_name}", dayName)
    .replaceAll("{market_pulse}", "focus on liquid, defined-risk options structures");
}

export function renderMarketingPost(input: {
  sourceContent: string;
  config: Pick<MarketingTaskConfig, "destinationUrl" | "utmParams">;
  generatedMarkdown?: string;
  now?: Date;
}): { finalUrl: string; body: string; postText: string } {
  const now = input.now ?? new Date();
  const dest = input.config.destinationUrl.trim();
  const finalUrl = withUtmParams(dest, input.config.utmParams);
  const rawBody =
    input.generatedMarkdown?.trim() && input.generatedMarkdown.trim().length > 0
      ? input.generatedMarkdown.trim()
      : interpolateMarketingTemplate(input.sourceContent, now);
  const body = stripStandaloneDuplicateDestinationUrls(rawBody, dest).trim();
  const postText = `${body}\n\n${finalUrl}\n\n${MANDATORY_MARKETING_DISCLAIMER}`;
  return { finalUrl, body, postText };
}
