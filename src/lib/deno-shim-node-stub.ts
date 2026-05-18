/**
 * Turbopack-safe stand-in for `@deno/shim-deno` (yahoo-finance2 v3 dependency).
 * The real shim pulls `child_process` and breaks Next production builds.
 * Runtime: yahoo-finance2 detects Node via `process.versions.node` without needing Deno APIs.
 */
export const Deno = {
  env: {
    get(key: string): string | undefined {
      return process.env[key];
    },
    toObject(): Record<string, string> {
      return { ...process.env } as Record<string, string>;
    },
    set(_key: string, _value: string): void {
      /* no-op — Next/server should not mutate env via Deno shim */
    },
    has(key: string): boolean {
      return Object.prototype.hasOwnProperty.call(process.env, key);
    },
    delete(_key: string): void {
      /* no-op */
    }
  }
};
