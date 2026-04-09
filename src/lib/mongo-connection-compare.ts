/**
 * Compare Mongo "fingerprints" from Next `getMongoConnectionLabel()` and Spring `/api/backend/health`
 * (`host:port/database`). Used by admin DB connection panel.
 */

function normalizeMongoFingerprint(s: string): string {
  return s.trim().toLowerCase().replace(/\/+$/, "");
}

export function parseMongoFingerprintLabel(label: string): { hostWithPort: string; database: string } | null {
  const idx = label.indexOf("/");
  if (idx <= 0) {
    return null;
  }
  const hostWithPort = label.slice(0, idx).trim();
  const database = label.slice(idx + 1).trim();
  if (!hostWithPort || !database) {
    return null;
  }
  return { hostWithPort, database };
}

export function mongoFingerprintStrictEqual(a: string, b: string): boolean {
  return normalizeMongoFingerprint(a) === normalizeMongoFingerprint(b);
}

/**
 * Next on the host (`127.0.0.1` / `localhost`) and Spring in Docker Compose (`mongodb` service name)
 * with the same database segment — typically the same physical Mongo when Compose publishes `27017`.
 */
export function isDockerComposeLoopbackVsServiceSkew(nextLabel: string, backendLabel: string): boolean {
  const n = parseMongoFingerprintLabel(nextLabel);
  const b = parseMongoFingerprintLabel(backendLabel);
  if (!n || !b || n.database !== b.database) {
    return false;
  }
  const hostOnly = (h: string) => h.split(":")[0]?.toLowerCase() ?? "";
  const nh = hostOnly(n.hostWithPort);
  const bh = hostOnly(b.hostWithPort);
  const nextLocal = nh === "127.0.0.1" || nh === "localhost";
  const backLocal = bh === "127.0.0.1" || bh === "localhost";
  const nextSvc = nh === "mongodb";
  const backSvc = bh === "mongodb";
  return (nextLocal && backSvc) || (nextSvc && backLocal);
}
