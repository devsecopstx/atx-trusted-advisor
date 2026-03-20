/** Normalize LB-provided host so Set-Cookie scope matches the browser URL (e.g. strip :443). */
export function stripDefaultPortFromHost(hostWithPort: string, proto: string): string {
  const p = proto.toLowerCase();
  if (p === "https" && hostWithPort.endsWith(":443")) {
    return hostWithPort.slice(0, -4);
  }
  if (p === "http" && hostWithPort.endsWith(":80")) {
    return hostWithPort.slice(0, -3);
  }
  return hostWithPort;
}

export function getPublicOriginFromRequest(request: Request): string {
  const url = new URL(request.url);
  const protoRaw = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const proto = protoRaw ? protoRaw.toLowerCase() : "https";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const hostWithPort = stripDefaultPortFromHost(forwardedHost ?? hostHeader ?? url.host, proto);
  return `${proto}://${hostWithPort}`;
}

export function getEffectiveHostname(request: Request): string {
  const url = new URL(request.url);
  const protoRaw = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const proto = protoRaw ? protoRaw.toLowerCase() : "https";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const hostWithPort = stripDefaultPortFromHost(forwardedHost ?? hostHeader ?? url.host, proto);
  return hostWithPort.split(":")[0] ?? hostWithPort;
}
