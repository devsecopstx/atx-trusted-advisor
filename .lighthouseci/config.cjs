/**
 * Lighthouse CI — perf baselines for product shells.
 *
 * Run from repo root (after a production build):
 *   NODE_ENV=production npm run build
 *   npx @lhci/cli@latest autorun --config=./.lighthouseci/config.cjs
 *
 * Port defaults to 3001 so `next dev` on 3000 does not block LHCI. Override:
 *   LHCI_PORT=3005 npx @lhci/cli@latest autorun --config=./.lighthouseci/config.cjs
 *
 * This repo uses `"type": "module"` — use `.cjs` so `module.exports` works.
 *
 * Note: /xchat, /portfolio, /portfolios, /xoptions are mostly auth-gated. Unauthenticated
 * runs score redirect/login/guest shells — for signed-in scores use puppeteerLoginScript
 * or auth cookies (see LHCI docs).
 */
const port = process.env.LHCI_PORT || "3001";
const origin = `http://localhost:${port}`;

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 2,
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
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"]
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
      outputDir: ".lighthouseci/reports"
    }
  }
};
