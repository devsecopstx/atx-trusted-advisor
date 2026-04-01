import { ObjectId } from "mongodb";

import { getAdminDeliveryChannelById } from "@/modules/core-admin/repository";

export class DeliveryChannelTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryChannelTargetError";
  }
}

/** Resolves optional admin delivery channel id for create (omit or empty → no ref). */
export async function resolveDeliveryChannelTargetForCreate(
  raw: string | undefined,
  tenantId: string
): Promise<ObjectId | undefined> {
  if (raw === undefined) {
    return undefined;
  }
  const t = raw.trim();
  if (t === "") {
    return undefined;
  }
  if (!ObjectId.isValid(t)) {
    throw new DeliveryChannelTargetError("Invalid deliveryChannelTarget");
  }
  const ch = await getAdminDeliveryChannelById(t, { tenantId });
  if (!ch) {
    throw new DeliveryChannelTargetError("deliveryChannelTarget not found");
  }
  return new ObjectId(t);
}

/** For PATCH: undefined → leave unchanged; null or "" → clear; string → set if valid. */
export async function resolveDeliveryChannelTargetForPatch(
  raw: string | null | undefined,
  tenantId: string
): Promise<ObjectId | null | undefined> {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  const t = raw.trim();
  if (t === "") {
    return null;
  }
  if (!ObjectId.isValid(t)) {
    throw new DeliveryChannelTargetError("Invalid deliveryChannelTarget");
  }
  const ch = await getAdminDeliveryChannelById(t, { tenantId });
  if (!ch) {
    throw new DeliveryChannelTargetError("deliveryChannelTarget not found");
  }
  return new ObjectId(t);
}
