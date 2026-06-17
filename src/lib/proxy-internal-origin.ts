/**
 * Origin for same-container fetches from Next middleware (`src/proxy.ts`).
 *
 * On Cloud Run, using `request.url` (public HTTPS host) for internal `/api/internal/*`
 * checks often throws `fetch failed` (hairpin / LB). Loopback avoids that.
 */
export function resolveProxyInternalOrigin(requestUrl: string | URL): string {
  const explicit = process.env.PROXY_INTERNAL_ORIGIN?.trim().replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }

  if (process.env.K_SERVICE?.trim()) {
    const port = process.env.PORT?.trim() || "8080";
    return `http://127.0.0.1:${port}`;
  }

  return new URL(requestUrl).origin;
}

export function resolveProxyInternalApiUrl(requestUrl: string | URL, apiPath: string): URL {
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return new URL(normalizedPath, `${resolveProxyInternalOrigin(requestUrl)}/`);
}
