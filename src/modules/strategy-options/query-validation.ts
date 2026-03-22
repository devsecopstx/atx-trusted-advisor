/**
 * Shared query validation for Yahoo-backed strategy-options APIs.
 * Reduces abuse (oversized symbols), injection-ish inputs, and NaN/Invalid Date drift.
 */

const UNDERLYING_MAX_LEN = 32;
/** Yahoo-style symbols: alnum, dot, hyphen, caret (indices). */
const UNDERLYING_PATTERN = /^[A-Z0-9.\-^]+$/;

export type ValidationErr = { ok: false; error: string; status: 400 };
export type ValidationOk<T> = { ok: true; value: T };

export function parseUnderlying(raw: string | null | undefined): ValidationErr | ValidationOk<string> {
  const u = raw?.trim().toUpperCase();
  if (!u) {
    return { ok: false, error: "underlying is required", status: 400 };
  }
  if (u.length > UNDERLYING_MAX_LEN) {
    return { ok: false, error: "underlying is too long", status: 400 };
  }
  if (!UNDERLYING_PATTERN.test(u)) {
    return { ok: false, error: "underlying contains invalid characters", status: 400 };
  }
  return { ok: true, value: u };
}

/** After {@link normalizeExpiration} — must be a real calendar day. */
export function validateNormalizedExpiration(normalized: string): ValidationErr | ValidationOk<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return { ok: false, error: "expiration must be YYYY-MM-DD or Yahoo unix seconds", status: 400 };
  }
  const t = new Date(`${normalized}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) {
    return { ok: false, error: "expiration is not a valid date", status: 400 };
  }
  return { ok: true, value: normalized };
}

export function parseStrike(raw: string | null | undefined): ValidationErr | ValidationOk<number> {
  if (raw == null || raw.trim() === "") {
    return { ok: true, value: 0 };
  }
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
    return { ok: false, error: "strike must be a non-negative number", status: 400 };
  }
  return { ok: true, value: n };
}
