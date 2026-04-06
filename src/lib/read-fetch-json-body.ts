/**
 * Read a fetch Response body as JSON when it looks like JSON; otherwise surface plain text
 * (e.g. edge/WAF 429 "Rate exceeded.") so callers avoid `Unexpected token` from `res.json()`.
 */
export async function readFetchJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<{ json: T }> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error(
      res.status === 429
        ? "Too many requests. Please wait a moment and retry."
        : `Request failed (${res.status})`
    );
  }
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error(
      res.status === 429
        ? "Too many requests. Please wait a moment and retry."
        : trimmed.slice(0, 300)
    );
  }
  try {
    return { json: JSON.parse(rawText) as T };
  } catch {
    throw new Error(
      res.status === 429
        ? "Too many requests. Please wait a moment and retry."
        : trimmed.slice(0, 300)
    );
  }
}
