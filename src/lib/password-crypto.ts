import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt32768";
const KEYLEN = 64;
const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function scryptPromise(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, SCRYPT_OPTS, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Async scrypt password hash for `core_users.passwordHash`.
 * Format: `scrypt32768$<saltBase64url>$<keyBase64url>`
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptPromise(plain, salt);
  return `${PREFIX}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(plain: string, stored: string | undefined): Promise<boolean> {
  const head = `${PREFIX}$`;
  if (!stored || !stored.startsWith(head)) {
    return false;
  }
  const rest = stored.slice(head.length);
  const sep = rest.indexOf("$");
  if (sep < 0) {
    return false;
  }
  const saltB64 = rest.slice(0, sep);
  const keyB64 = rest.slice(sep + 1);
  if (!saltB64 || !keyB64) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, "base64url");
    expected = Buffer.from(keyB64, "base64url");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length !== KEYLEN) {
    return false;
  }
  let derived: Buffer;
  try {
    derived = await scryptPromise(plain, salt);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
