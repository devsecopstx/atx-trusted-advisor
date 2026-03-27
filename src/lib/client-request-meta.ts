/** Client hints from edge / reverse proxy (Cloud Run, Cloudflare, etc.). */

export type ClientLoginMeta = {
  clientIp?: string;
  country?: string;
  userAgent?: string;
};

function sanitizeIp(raw: string): string | undefined {
  const t = raw.trim().slice(0, 128);
  if (!t) {
    return undefined;
  }
  if (/^[\d.a-fA-F:%[\]-]+$/.test(t)) {
    return t;
  }
  return undefined;
}

/**
 * Best-effort client IP + optional CF country + User-Agent for admin visibility.
 */
export function extractClientLoginMeta(request: Request): ClientLoginMeta {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  const firstForwarded = xff?.split(",")[0]?.trim();
  const cfConnecting = h.get("cf-connecting-ip")?.trim();
  const realIp = h.get("x-real-ip")?.trim();
  const clientIp = sanitizeIp(cfConnecting || firstForwarded || realIp || "");
  const countryRaw = h.get("cf-ipcountry")?.trim().toUpperCase();
  const country =
    countryRaw && countryRaw !== "XX" && /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : undefined;
  const ua = h.get("user-agent")?.trim().slice(0, 256);
  return {
    clientIp,
    country,
    userAgent: ua && ua.length > 0 ? ua : undefined
  };
}
