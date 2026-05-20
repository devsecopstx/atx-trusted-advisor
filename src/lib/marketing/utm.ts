export type UtmParams = {
  utm_source: string;
  utm_campaign: string;
  utm_medium?: string;
  utm_content?: string;
  utm_term?: string;
};

const DEFAULT_BASE = "https://fintech-advisor.ai";

export function withUtmParams(href: string, utm: UtmParams): string {
  const trimmed = href.trim();
  if (!trimmed) {
    return href;
  }
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const url = new URL(trimmed, DEFAULT_BASE);
  url.searchParams.set("utm_source", utm.utm_source);
  url.searchParams.set("utm_campaign", utm.utm_campaign);
  if (utm.utm_medium) {
    url.searchParams.set("utm_medium", utm.utm_medium);
  }
  if (utm.utm_content) {
    url.searchParams.set("utm_content", utm.utm_content);
  }
  if (utm.utm_term) {
    url.searchParams.set("utm_term", utm.utm_term);
  }
  const resolved = url.pathname + url.search + url.hash;
  return isAbsolute ? url.toString() : resolved;
}
