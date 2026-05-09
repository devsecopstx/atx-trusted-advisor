/**
 * Lighthouse CI — **authenticated** baselines for product shells.
 *
 * Mirrors `config.cjs` (same routes, same desktop preset) but injects a signed
 * `xf_core_session` cookie via `extraHeaders` so LHCI captures the **signed-in**
 * shell (full xChat thread, real portfolio table, watchlist live cells, etc.) —
 * not the guest/redirect shell.
 *
 * Workflow (local):
 *
 *   # 1. produce a production build the LHCI server will start
 *   NODE_ENV=production npm run build
 *
 *   # 2. mint a session cookie from `.env` (see scripts/lhci/mint-session-cookie.mjs)
 *   export LHCI_AUTH_COOKIE="$(node scripts/lhci/mint-session-cookie.mjs --env-file=.env \
 *     --user-id=<userId> --tenant-id=<tenantId>)"
 *
 *   # 3. run authenticated audit (LHCI starts `next start` on $LHCI_PORT, default 3001)
 *   npx @lhci/cli@latest autorun --config=./.lighthouseci/config.auth.cjs
 *
 * Or use the convenience scripts:
 *
 *   npm run lh:local:auth        # full categories
 *   npm run lh:local:auth:perf   # performance-only (faster iteration)
 *
 * Notes:
 * - `extraHeaders.Cookie` is sent on **every navigation** the audit makes, so
 *   the LHCI run lands on the signed-in shell rather than the access-pending /
 *   guest variant. Do **not** reuse this cookie outside LHCI.
 * - Local runs require a live MongoDB (most app_user routes hydrate from Mongo).
 *   Pair with `npm run mongo:up` + `npm run seed:admin` first.
 * - For live prod authenticated runs, see `config.prod-remote.auth.cjs`.
 *
 * This repo uses `"type": "module"` — keep this file `.cjs` so `module.exports` works.
 */
const port = process.env.LHCI_PORT || "3001";
const origin = `http://localhost:${port}`;

const authCookie = process.env.LHCI_AUTH_COOKIE;
if (!authCookie) {
  throw new Error(
    "LHCI_AUTH_COOKIE is required for authenticated LHCI runs. Mint with " +
      "`node scripts/lhci/mint-session-cookie.mjs --env-file=.env --user-id=<id> --tenant-id=<id>`"
  );
}
const cookieHeader = authCookie.includes("xf_core_session=")
  ? authCookie
  : `xf_core_session=${authCookie}`;

const onlyPerf = process.env.LHCI_PERF_ONLY === "1" || process.env.LHCI_PERF_ONLY === "true";

module.exports = {
  ci: {
    collect: {
      numberOfRuns: Number(process.env.LHCI_RUNS || "2"),
      startServerCommand: `PORT=${port} npm run start`,
      startServerReadyPattern: "Local:",
      url: [
        `${origin}/xchat`,
        `${origin}/portfolio`,
        `${origin}/portfolios`,
        `${origin}/xoptions`
      ],
      settings: {
        preset: "desktop",
        onlyCategories: onlyPerf
          ? ["performance"]
          : ["performance", "accessibility", "best-practices", "seo"],
        extraHeaders: { Cookie: cookieHeader }
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.85 }]
      }
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports-auth"
    }
  }
};
