/**
 * Best-effort per-tenant inflight cap for rental AI routes (single-instance honest).
 * Replace with Redis semaphores when multi-instance enforcement is required.
 */
type SlotMap = Map<string, number>;

const globalSlots = globalThis as typeof globalThis & {
  __xfRentalAiInflight?: SlotMap;
};

const slots: SlotMap = globalSlots.__xfRentalAiInflight ?? new Map();
if (!globalSlots.__xfRentalAiInflight) {
  globalSlots.__xfRentalAiInflight = slots;
}

export function tryAcquireRentalAiInflight(tenantIdHex: string, maxConcurrent: number): boolean {
  const key = tenantIdHex.trim();
  if (!key || maxConcurrent < 1) {
    return false;
  }
  const cur = slots.get(key) ?? 0;
  if (cur >= maxConcurrent) {
    return false;
  }
  slots.set(key, cur + 1);
  return true;
}

export function releaseRentalAiInflight(tenantIdHex: string): void {
  const key = tenantIdHex.trim();
  if (!key) {
    return;
  }
  const cur = (slots.get(key) ?? 1) - 1;
  if (cur <= 0) {
    slots.delete(key);
  } else {
    slots.set(key, cur);
  }
}
