/** Rejects open redirects and path traversal; only same-origin relative paths. Edge-safe (no Node APIs). */
export function isSafeOAuthReturnPath(path: string): boolean {
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//")) {
    return false;
  }
  if (p.includes("..")) {
    return false;
  }
  if (p.length > 512) {
    return false;
  }
  if (/[\r\n\0]/.test(p)) {
    return false;
  }
  return true;
}
