/**
 * Lighthouse CI against **live** production (no local server).
 *
 *   npm run lh:prod
 *
 * Same URL set as config.cjs but hits PROD_ORIGIN. Guest/redirect shells only unless
 * you add puppeteerLoginScript / cookies (see LHCI docs).
 *
 * Reported baseline: atx-docs/design-system/current-state-features.md
 * § "Lighthouse production baseline (2026-04-08)".
 */
const origin = process.env.LHCI_PROD_ORIGIN || "https://fintech-advisor.ai";

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
      outputDir: ".lighthouseci/reports-prod"
    }
  }
};
