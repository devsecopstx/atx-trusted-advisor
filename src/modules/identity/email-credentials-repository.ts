import { randomBytes } from "node:crypto";

import { ObjectId } from "mongodb";

import { hashAuthLookupToken } from "@/lib/auth-token-hash";
import { getDb } from "@/lib/mongodb";
import { hashPassword, verifyPassword } from "@/lib/password-crypto";
import { canUserLogin } from "@/modules/identity/authorization";
import type { CoreUser } from "@/modules/identity/types";

import { ensureIdentityIndexes } from "./repository";

const USERS = "core_users";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;

export function createRawAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueCredentialInviteForUser(userId: ObjectId): Promise<{ rawToken: string } | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const rawToken = createRawAuthToken();
  const tokenHash = hashAuthLookupToken(rawToken);
  const expires = new Date(Date.now() + INVITE_TTL_MS);
  const now = new Date();
  const res = await db.collection<CoreUser>(USERS).updateOne(
    { _id: userId },
    {
      $set: {
        credentialInviteTokenHash: tokenHash,
        credentialInviteExpiresAt: expires,
        updatedAt: now
      },
      $unset: {
        passwordResetTokenHash: "",
        passwordResetExpiresAt: ""
      }
    }
  );
  return res.matchedCount === 1 ? { rawToken } : null;
}

export async function findUserByCredentialInviteToken(rawToken: string): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const h = hashAuthLookupToken(rawToken);
  return db.collection<CoreUser>(USERS).findOne({ credentialInviteTokenHash: h });
}

export type CompleteCredentialInviteResult =
  | { ok: true; userId: ObjectId }
  | { ok: false; code: "invalid_or_expired" | "already_has_password" | "not_authorized" | "suspended" };

export async function completeCredentialInvite(input: {
  rawToken: string;
  plainPassword: string;
}): Promise<CompleteCredentialInviteResult> {
  const user = await findUserByCredentialInviteToken(input.rawToken.trim());
  if (!user?._id) {
    return { ok: false, code: "invalid_or_expired" };
  }
  if (user.status === "suspended") {
    return { ok: false, code: "suspended" };
  }
  const exp = user.credentialInviteExpiresAt;
  if (!exp || exp.getTime() < Date.now()) {
    return { ok: false, code: "invalid_or_expired" };
  }
  if (user.passwordHash && user.passwordHash.length > 0) {
    return { ok: false, code: "already_has_password" };
  }
  if (!canUserLogin(user.roles)) {
    return { ok: false, code: "not_authorized" };
  }
  const passwordHash = await hashPassword(input.plainPassword);
  const now = new Date();
  const db = await getDb();
  const h = hashAuthLookupToken(input.rawToken.trim());
  /** Invite token was delivered to this mailbox — treat as verified for login/session (matches login UX expectations post–access approval). */
  const emailVerifiedAt = user.emailVerifiedAt ?? now;
  const res = await db.collection<CoreUser>(USERS).updateOne(
    {
      _id: user._id,
      credentialInviteTokenHash: h,
      credentialInviteExpiresAt: { $gt: now },
      $or: [{ passwordHash: { $exists: false } }, { passwordHash: "" }]
    },
    {
      $set: {
        passwordHash,
        credentialsVerifiedAt: now,
        emailVerifiedAt,
        updatedAt: now
      },
      $unset: {
        credentialInviteTokenHash: "",
        credentialInviteExpiresAt: "",
        emailVerificationTokenHash: "",
        emailVerificationExpiresAt: ""
      }
    }
  );
  if (res.modifiedCount !== 1) {
    return { ok: false, code: "invalid_or_expired" };
  }
  return { ok: true, userId: user._id };
}

export async function verifyUserPassword(user: CoreUser, plainPassword: string): Promise<boolean> {
  return verifyPassword(plainPassword, user.passwordHash);
}

/**
 * Guest billing signup: set password when none exists yet so email/password login works after access approval
 * (skips separate invite flow). Does not grant roles.
 */
export async function setInitialPasswordFromPublicSignup(input: {
  userId: ObjectId;
  plainPassword: string;
}): Promise<{ ok: true } | { ok: false; code: "not_found" | "already_has_password" }> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const user = await db.collection<CoreUser>(USERS).findOne({ _id: input.userId });
  if (!user) {
    return { ok: false, code: "not_found" };
  }
  if (user.passwordHash && typeof user.passwordHash === "string" && user.passwordHash.length > 0) {
    return { ok: false, code: "already_has_password" };
  }
  const passwordHash = await hashPassword(input.plainPassword);
  const now = new Date();
  const emailVerifiedAt = user.emailVerifiedAt ?? now;
  const res = await db.collection<CoreUser>(USERS).updateOne(
    {
      _id: input.userId,
      $or: [{ passwordHash: { $exists: false } }, { passwordHash: "" }]
    },
    {
      $set: {
        passwordHash,
        emailVerifiedAt,
        credentialsVerifiedAt: now,
        updatedAt: now
      }
    }
  );
  if (res.modifiedCount !== 1) {
    return { ok: false, code: "already_has_password" };
  }
  return { ok: true };
}

export async function issuePasswordResetForUser(userId: ObjectId): Promise<{ rawToken: string } | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const u = await db.collection<CoreUser>(USERS).findOne({ _id: userId });
  if (!u?.passwordHash || typeof u.passwordHash !== "string" || u.passwordHash.length < 8) {
    return null;
  }
  const rawToken = createRawAuthToken();
  const tokenHash = hashAuthLookupToken(rawToken);
  const expires = new Date(Date.now() + RESET_TTL_MS);
  const now = new Date();
  const res = await db.collection<CoreUser>(USERS).updateOne(
    { _id: userId },
    {
      $set: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expires,
        updatedAt: now
      }
    }
  );
  return res.matchedCount === 1 ? { rawToken } : null;
}

export async function findUserByPasswordResetToken(rawToken: string): Promise<CoreUser | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const h = hashAuthLookupToken(rawToken.trim());
  return db.collection<CoreUser>(USERS).findOne({ passwordResetTokenHash: h });
}

export type CompletePasswordResetResult =
  | { ok: true; userId: ObjectId }
  | { ok: false; code: "invalid_or_expired" | "suspended" };

export async function completePasswordReset(input: {
  rawToken: string;
  plainPassword: string;
}): Promise<CompletePasswordResetResult> {
  const user = await findUserByPasswordResetToken(input.rawToken);
  if (!user?._id) {
    return { ok: false, code: "invalid_or_expired" };
  }
  if (user.status === "suspended") {
    return { ok: false, code: "suspended" };
  }
  const exp = user.passwordResetExpiresAt;
  if (!exp || exp.getTime() < Date.now()) {
    return { ok: false, code: "invalid_or_expired" };
  }
  const passwordHash = await hashPassword(input.plainPassword);
  const now = new Date();
  const db = await getDb();
  const h = hashAuthLookupToken(input.rawToken.trim());
  const res = await db.collection<CoreUser>(USERS).updateOne(
    {
      _id: user._id,
      passwordResetTokenHash: h,
      passwordResetExpiresAt: { $gt: now }
    },
    {
      $set: {
        passwordHash,
        credentialsVerifiedAt: now,
        updatedAt: now
      },
      $unset: {
        passwordResetTokenHash: "",
        passwordResetExpiresAt: ""
      }
    }
  );
  if (res.modifiedCount !== 1) {
    return { ok: false, code: "invalid_or_expired" };
  }
  return { ok: true, userId: user._id };
}

export async function issueEmailVerificationForUser(userId: ObjectId): Promise<{ rawToken: string } | null> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const rawToken = createRawAuthToken();
  const tokenHash = hashAuthLookupToken(rawToken);
  const expires = new Date(Date.now() + VERIFY_EMAIL_TTL_MS);
  const now = new Date();
  const res = await db.collection<CoreUser>(USERS).updateOne(
    { _id: userId },
    {
      $set: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expires,
        updatedAt: now
      }
    }
  );
  return res.matchedCount === 1 ? { rawToken } : null;
}

export type CompleteEmailVerificationResult =
  | { ok: true; userId: ObjectId }
  | { ok: false; code: "invalid_or_expired" | "already_verified" };

export async function completeEmailVerification(input: {
  rawToken: string;
}): Promise<CompleteEmailVerificationResult> {
  await ensureIdentityIndexes();
  const db = await getDb();
  const now = new Date();
  const tokenHash = hashAuthLookupToken(input.rawToken.trim());
  const user = await db.collection<CoreUser>(USERS).findOne({ emailVerificationTokenHash: tokenHash });
  if (!user?._id) {
    return { ok: false, code: "invalid_or_expired" };
  }
  if (user.emailVerifiedAt instanceof Date) {
    return { ok: false, code: "already_verified" };
  }
  const exp = user.emailVerificationExpiresAt;
  if (!exp || exp.getTime() < Date.now()) {
    return { ok: false, code: "invalid_or_expired" };
  }
  const res = await db.collection<CoreUser>(USERS).updateOne(
    {
      _id: user._id,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: now }
    },
    {
      $set: {
        emailVerifiedAt: now,
        updatedAt: now
      },
      $unset: {
        emailVerificationTokenHash: "",
        emailVerificationExpiresAt: ""
      }
    }
  );
  if (res.modifiedCount !== 1) {
    return { ok: false, code: "invalid_or_expired" };
  }
  return { ok: true, userId: user._id };
}
