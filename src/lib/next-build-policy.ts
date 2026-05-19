/**
 * Build-policy helpers consumed by `next.config.ts` (and only `next.config.ts`).
 *
 * Kept under `src/lib/` so they can be imported by Vitest unit tests with the
 * standard `@/lib/...` alias. `next.config.ts` itself uses a relative import
 * because Next loads the config file via Node before the bundler alias map is
 * active.
 *
 * See `.cursor/agents/sre.md` → *`allowedDevOrigins` is dev-only (gated)* and
 * the `outputFileTracingIncludes` note for `POST /api/reports/options-scan`.
 */

const DEV_ALLOWED_LOOPBACK_ORIGINS = ["127.0.0.1", "localhost"] as const;

/**
 * Loopback origins that `next dev` cross-origin checks must trust. Returns
 * `undefined` in production builds so the field is omitted from the prod
 * Cloud Run revision (config-posture hygiene; Next ignores the field outside
 * `next dev` today, but our config artifacts should not include dev-only
 * origins in prod).
 */
export function buildDevOnlyAllowedOrigins(
  nodeEnv: string | undefined
): readonly string[] | undefined {
  if (nodeEnv === "production") {
    return undefined;
  }
  return DEV_ALLOWED_LOOPBACK_ORIGINS;
}

/**
 * Repo-relative paths to bundle into the standalone build for specific App
 * Router routes. Keys are route paths as expected by Next's
 * `outputFileTracingIncludes`. Values are micromatch globs **relative to the
 * repo root**.
 *
 * Currently used to ship the Python ReportLab generator alongside
 * `POST /api/reports/options-scan` (spawned via `child_process.spawn`).
 * The route avoids exposing a literal-string path so Turbopack NFT does not
 * over-trace; this map is the explicit allowlist instead.
 */
/** Baked RAG tree for admin review + xAI/Mongo sync on Cloud Run (read-only in prod). */
export const RAG_COLLECTION_STANDALONE_TRACE_GLOBS = Object.freeze(["./atx-docs/rag-collection/**"] as const);

const ADMIN_RAG_INGEST_TRACE_ROUTES = [
  "/api/admin/rag-ingest",
  "/api/admin/rag-ingest/ingest",
  "/api/admin/rag-ingest/[slug]",
  "/api/admin/rag-ingest/[slug]/seed",
  "/api/admin/rag-ingest/[slug]/download/[filename]",
  "/api/admin/rag/refresh-finance"
] as const;

export const STANDALONE_OUTPUT_FILE_TRACING_INCLUDES: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  "/api/reports/options-scan": Object.freeze(["./services/report-service/**"]),
  ...Object.fromEntries(
    ADMIN_RAG_INGEST_TRACE_ROUTES.map((route) => [route, RAG_COLLECTION_STANDALONE_TRACE_GLOBS])
  )
});

/**
 * Packages that must stay external on the Node server bundle (not traced by Turbopack).
 * `yahoo-finance2@3` pulls `@deno/shim-deno` → `child_process`, which breaks App Route /
 * RSC builds when bundled.
 */
export const SERVER_EXTERNAL_PACKAGES = Object.freeze([
  "mongodb",
  "redis",
  "yahoo-finance2"
] as const);

/** Repo-relative path aliased over `@deno/shim-deno` in `next.config.ts` (Turbopack). */
export const DENO_SHIM_NODE_STUB_RELATIVE = "./src/lib/deno-shim-node-stub.ts" as const;
