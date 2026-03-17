import {
  XaiCollectionNotFoundError,
  getXaiCollectionById,
  hasXaiManagementApiKey
} from "@/lib/xai";
import { updatePersonasCollectionVerification } from "@/modules/xchat/repository";
import type { PersonaCollectionVerification } from "@/modules/xchat/types";

type XaiCollectionVerificationState = PersonaCollectionVerification;

const VERIFICATION_TTL_MS = 5 * 60_000;
const verificationCache = new Map<string, XaiCollectionVerificationState>();
const verificationInFlight = new Map<string, Promise<void>>();

export function verifyXaiCollectionNonBlocking(collectionId: string): void {
  const normalizedCollectionId = collectionId.trim();
  if (!normalizedCollectionId) {
    return;
  }

  const cached = verificationCache.get(normalizedCollectionId);
  if (cached && Date.now() - cached.checkedAt.getTime() < VERIFICATION_TTL_MS) {
    return;
  }
  if (verificationInFlight.has(normalizedCollectionId)) {
    return;
  }
  startVerification(normalizedCollectionId);
}

export function triggerXaiCollectionVerification(collectionId: string): {
  started: boolean;
  reason?: "missing_collection_id" | "already_running";
} {
  const normalizedCollectionId = collectionId.trim();
  if (!normalizedCollectionId) {
    return { started: false, reason: "missing_collection_id" };
  }
  if (verificationInFlight.has(normalizedCollectionId)) {
    return { started: false, reason: "already_running" };
  }
  verificationCache.delete(normalizedCollectionId);
  startVerification(normalizedCollectionId);
  return { started: true };
}

function setState(collectionId: string, nextState: Omit<XaiCollectionVerificationState, "checkedAt">) {
  const state: XaiCollectionVerificationState = {
    ...nextState,
    checkedAt: new Date()
  };
  verificationCache.set(collectionId, state);
  void persistVerification(collectionId, state);
}

async function runVerification(collectionId: string): Promise<void> {
  if (!hasXaiManagementApiKey()) {
    setState(collectionId, {
      status: "skipped",
      message: "XAI_MANAGEMENT_API_KEY is not configured"
    });
    return;
  }

  try {
    const collection = await getXaiCollectionById(collectionId);
    setState(collectionId, {
      status: "verified",
      resolvedCollectionName: collection.name
    });
  } catch (error) {
    if (error instanceof XaiCollectionNotFoundError) {
      setState(collectionId, {
        status: "missing",
        message: error.message
      });
      return;
    }
    setState(collectionId, {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown verification error"
    });
  }
}

async function persistVerification(
  collectionId: string,
  state: XaiCollectionVerificationState
): Promise<void> {
  try {
    await updatePersonasCollectionVerification(collectionId, state);
  } catch (error) {
    console.error(
      `[xpersona/verification] failed to persist verifier state for ${collectionId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

function startVerification(collectionId: string): void {
  const verificationPromise = runVerification(collectionId).finally(() => {
    verificationInFlight.delete(collectionId);
  });
  verificationInFlight.set(collectionId, verificationPromise);
  void verificationPromise;
}
