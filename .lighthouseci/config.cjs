/**
 * Lighthouse CI — perf baselines for product shells.
 *
 * Run from repo root (after a production build):
 *   NODE_ENV=production npm run build
 *   npx @lhci/cli@latest autorun --config=./.lighthouseci/config.cjs
 *
 * Live prod (no local server): `npm run lh:prod` → `.lighthouseci/config.prod-remote.cjs`
 *
 * Port defaults to 3001 so `next dev` on 3000 does not block LHCI. Override:
 *   LHCI_PORT=3005 npx @lhci/cli@latest autorun --config=./.lighthouseci/config.cjs
 *
 * This repo uses `"type": "module"` — use `.cjs` so `module.exports` works.
 *
 * Note: /xchat, /portfolio, /portfolios, /xoptions are mostly auth-gated. Unauthenticated
 * runs score redirect/login/guest shells — for signed-in scores use puppeteerLoginScript
 * or auth cookies (see LHCI docs).
 *
 * Reported baselines / targets (dated): atx-docs/design-system/current-state-features.md
 * § "Lighthouse production baseline (2026-04-08)" + "xChat & Portfolios targets (2026-04-08 LHCI)".
 */
const port = process.env.LHCI_PORT || "3001";
const origin = `http://localhost:${port}`;

const onlyPerf = process.env.LHCI_PERF_ONLY === "1" || process.env.LHCI_PERF_ONLY === "true";

const assertAssertions = {
  "categories:performance": ["warn", { minScore: 0.5 }]
};
if (!onlyPerf) {
  assertAssertions["categories:accessibility"] = ["warn", { minScore: 0.85 }];
}

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
          : ["performance", "accessibility", "best-practices", "seo"]
      }
    },
    assert: {
      assertions: assertAssertions
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports"
    }
  }
};
