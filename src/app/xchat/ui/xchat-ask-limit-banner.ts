export type XchatUsageLimitCode =
  | "xchat_daily_limit_exceeded"
  | "xchat_hourly_limit_exceeded"
  | "xchat_rate_limit_exceeded";

export type XchatAskLimitBannerInput = {
  code?: string;
  error?: string;
  dailyLimit?: number;
  hourlyLimit?: number;
  retryAfterSeconds?: number;
  resetAt?: string;
  contactAdmin?: boolean;
  responseStatus?: number;
};

export function isXchatUsageLimitCode(code: string | undefined): code is XchatUsageLimitCode {
  return (
    code === "xchat_daily_limit_exceeded" ||
    code === "xchat_hourly_limit_exceeded" ||
    code === "xchat_rate_limit_exceeded"
  );
}

export function buildXchatAskLimitBannerMarkdown(input: XchatAskLimitBannerInput): string {
  const friendly = input.contactAdmin === true;
  const resetHint = (() => {
    if (typeof input.resetAt === "string" && input.resetAt.trim()) {
      const d = new Date(input.resetAt);
      if (!Number.isNaN(d.getTime())) {
        return `\n\n**Next window:** about **${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}** (server estimate from UTC buckets).`;
      }
    }
    if (typeof input.retryAfterSeconds === "number" && input.retryAfterSeconds > 0) {
      const mins = Math.ceil(input.retryAfterSeconds / 60);
      return mins >= 2
        ? `\n\n**Try again in ~${mins} min** (${input.retryAfterSeconds}s).`
        : `\n\n**Try again in ~${input.retryAfterSeconds}s.**`;
    }
    return "";
  })();
  const limitSuffix =
    input.code === "xchat_daily_limit_exceeded" && typeof input.dailyLimit === "number"
      ? `\n\nWorkspace daily cap: **${input.dailyLimit}** prompts per UTC day (tenant + plan effective limit).`
      : input.code === "xchat_hourly_limit_exceeded" && typeof input.hourlyLimit === "number"
        ? `\n\nWorkspace hourly cap: **${input.hourlyLimit}** prompts per UTC clock hour.`
        : "";
  const codePrefix = friendly
    ? input.code === "xchat_daily_limit_exceeded"
      ? "**Daily limit reached**\n\n"
      : input.code === "xchat_hourly_limit_exceeded"
        ? "**Hourly limit reached**\n\n"
        : input.code === "xchat_rate_limit_exceeded"
          ? "**Sending too fast**\n\n"
          : input.code
            ? "**Limit**\n\n"
            : ""
    : input.code === "xchat_daily_limit_exceeded"
      ? "**`xchat_daily_limit_exceeded`** — daily prompt cap (UTC calendar day).\n\n"
      : input.code === "xchat_hourly_limit_exceeded"
        ? "**`xchat_hourly_limit_exceeded`** — hourly prompt cap (UTC clock hour).\n\n"
        : input.code === "xchat_rate_limit_exceeded"
          ? "**`xchat_rate_limit_exceeded`** — per-minute send throttle (burst protection).\n\n"
          : input.code
            ? `**\`${input.code}\`**\n\n`
            : "";
  const base = input.error ?? `Request failed (${input.responseStatus ?? "unknown"})`;
  const upgrade =
    "\n\n---\n\n**Plans / billing:** [Account → Billing](/account/billing). Ask your workspace admin if you need higher caps.";
  return `${codePrefix}${base}${limitSuffix}${resetHint}${upgrade}`;
}
