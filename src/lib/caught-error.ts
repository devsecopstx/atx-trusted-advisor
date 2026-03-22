const MAX_CAUSE_DEPTH = 6;

/** Safe string for logs when `catch (unknown)` — avoids empty `{}` in structured logs and Next overlays. */
export function caughtErrorMessage(error: unknown, depth = 0): string {
  if (depth > MAX_CAUSE_DEPTH) {
    return "(cause chain truncated)";
  }
  if (error instanceof Error) {
    const base = error.message.trim();
    const name = error.name && error.name !== "Error" ? error.name : "";
    const cause =
      "cause" in error && error.cause !== undefined
        ? caughtErrorMessage(error.cause as unknown, depth + 1)
        : "";
    const parts = [
      name ? `[${name}]` : "",
      base || "(no message)",
      cause && cause !== "unknown" ? `cause: ${cause}` : ""
    ].filter(Boolean);
    const joined = parts.join(" ").trim();
    if (joined) {
      return joined;
    }
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    const er = o.errorResponse;
    if (er && typeof er === "object") {
      const erObj = er as Record<string, unknown>;
      const erm =
        typeof erObj.errmsg === "string" && erObj.errmsg.trim() ? erObj.errmsg.trim() : "";
      const code = erObj.code !== undefined ? String(erObj.code) : "";
      if (erm || code) {
        return code ? `${code}: ${erm || "(no errmsg)"}` : erm;
      }
    }
    const errmsg =
      typeof o.errmsg === "string" && o.errmsg.trim() ? o.errmsg.trim() : "";
    const msg =
      typeof o.message === "string" && o.message.trim() ? o.message.trim() : "";
    if (typeof o.code !== "undefined") {
      const code = String(o.code);
      const detail = errmsg || msg;
      return detail ? `${code}: ${detail}` : `code=${code}`;
    }
    if (errmsg) {
      return errmsg;
    }
    if (msg) {
      return msg;
    }
  }
  try {
    const s = JSON.stringify(error);
    if (s !== "{}" && s !== "null" && s !== "undefined") {
      return s;
    }
  } catch {
    /* ignore */
  }
  const tag = error === undefined || error === null ? "unknown" : Object.prototype.toString.call(error);
  return tag === "[object Object]" && error && typeof error === "object"
    ? `plain object keys=${Object.keys(error as object).join(",") || "(none)"}`
    : tag;
}
