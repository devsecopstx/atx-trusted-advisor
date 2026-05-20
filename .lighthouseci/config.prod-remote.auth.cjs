/**
 * Lighthouse CI against **live** production with authenticated session cookie.
 *
 *   # mint with the **prod** AUTH_SECRET (from `.env.prod` or Secret Manager)
 *   export LHCI_PROD_AUTH_COOKIE="$(node scripts/lhci/mint-session-cookie.mjs --env-file=.env.prod \
 *     --user-id=<prod-userId> --tenant-id=<prod-tenantId>)"
 *   npm run lh:prod:auth
 *
 * Same URL set as `config.prod-remote.cjs`, but rides a signed `xf_core_session`
 * so LHCI captures the **signed-in** prod surface (not the guest landing).
 *
 * Reports land in `.lighthouseci/reports-prod-auth/` (kept distinct from the
 * guest run’s `reports-prod/`).
 */
const origin = process.env.LHCI_PROD_ORIGIN || "https://fintech-advisor.ai";

const authCookie = process.env.LHCI_PROD_AUTH_COOKIE || process.env.LHCI_AUTH_COOKIE;
if (!authCookie) {
  throw new Error(
    "LHCI_PROD_AUTH_COOKIE (or LHCI_AUTH_COOKIE) is required. Mint with " +
      "`node scripts/lhci/mint-session-cookie.mjs --env-file=.env.prod --user-id=<id> --tenant-id=<id>`"
  );
}
const cookieHeader = authCookie.includes("xf_core_session=")
  ? authCookie
  : `xf_core_session=${authCookie}`;

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
          : ["performance", "accessibility", "best-practices", "seo"],
        extraHeaders: { Cookie: cookieHeader }
      }
    },
    assert: {
      assertions: assertAssertions
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports-prod-auth"
    }
  }
};
