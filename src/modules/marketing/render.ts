import { withUtmParams } from "@/lib/marketing/utm";
import type { MarketingTaskConfig } from "@/modules/marketing/types";

export const MANDATORY_MARKETING_DISCLAIMER =
  "Educational conversations only. Not personalized investment advice. https://atx.fintech-advisor.ai";

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
  const finalUrl = withUtmParams(input.config.destinationUrl, input.config.utmParams);
  const body =
    input.generatedMarkdown?.trim() && input.generatedMarkdown.trim().length > 0
      ? input.generatedMarkdown.trim()
      : interpolateMarketingTemplate(input.sourceContent, now);
  const postText = `${body}\n\n${finalUrl}\n\n${MANDATORY_MARKETING_DISCLAIMER}`;
  return { finalUrl, body, postText };
}
