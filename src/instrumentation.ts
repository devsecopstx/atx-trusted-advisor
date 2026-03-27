/**
 * Next.js server bootstrap — runs once per Node server process (not Edge).
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  try {
    const { logRedisStartupHealthCheck } = await import("@/lib/redis-client");
    await logRedisStartupHealthCheck();
  } catch (error) {
    console.warn(
      "[startup/redis] preflight failed to run",
      error instanceof Error ? error.message : String(error)
    );
  }
}
