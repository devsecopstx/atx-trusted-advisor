import { AsyncLocalStorage } from "node:async_hooks";

type XchatDebugStore = {
  tenantXchatDebug: boolean;
};

const als = new AsyncLocalStorage<XchatDebugStore>();

/** Scope xChat debug logging for one request when tenant has `tenantPreferences.xchat_debug_enabled`. */
export function runWithXchatTenantDebug<T>(tenantDebug: boolean, fn: () => T): T {
  return als.run({ tenantXchatDebug: tenantDebug }, fn);
}

export function runWithXchatTenantDebugAsync<T>(tenantDebug: boolean, fn: () => Promise<T>): Promise<T> {
  return als.run({ tenantXchatDebug: tenantDebug }, fn);
}

export function getXchatTenantDebugFromContext(): boolean {
  return als.getStore()?.tenantXchatDebug === true;
}
