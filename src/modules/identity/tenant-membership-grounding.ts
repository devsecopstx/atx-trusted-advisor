import { ObjectId } from "mongodb";

/**
 * Normalize a `core_tenant_memberships.tenantId` field to canonical 24-char lowercase hex
 * for comparisons during session edge grounding (handles ObjectId + valid hex strings).
 */
export function normalizeTenantIdHexFromStoredMembershipField(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof ObjectId) {
    return value.toHexString();
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) {
      return null;
    }
    return ObjectId.isValid(t) ? new ObjectId(t).toHexString() : null;
  }
  try {
    return new ObjectId(value as ObjectId).toHexString();
  } catch {
    return null;
  }
}
