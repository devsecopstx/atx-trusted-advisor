import { createHash } from "node:crypto";

/** SHA-256 hex of raw invite/reset token for indexed Mongo lookup (token never stored plaintext). */
export function hashAuthLookupToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
