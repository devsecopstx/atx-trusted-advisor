/**
 * Next.js server bootstrap — runs once per Node server process (not Edge).
 * Keep this non-blocking: Cloud Run awaits `register()` before marking the revision healthy;
 * awaiting Redis (or other I/O) here can exceed startup probes and fail deploy with
 * "failed to start and listen on the port … PORT=8080".
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  void import("@/lib/redis-client")
    .then((mod) => mod.logRedisStartupHealthCheck())
    .catch((error) => {
      console.warn(
        "[startup/redis] preflight failed to run",
        error instanceof Error ? error.message : String(error)
      );
    });
}
