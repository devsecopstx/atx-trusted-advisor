import type { Metadata } from "next";
import Link from "next/link";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { canUserLogin } from "@/modules/identity/authorization";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Quant Trader Guide | Greeks, Monte Carlo & xChat Prompts | Resources",
  description:
    "Quant desk workflows for xFinance: Monte Carlo tail-risk, Greeks exposure rollups, delta-scoped chain scans, and copy-paste xChat prompts for the quant-trader persona.",
  keywords: [
    "quant trader options",
    "options Greeks desk",
    "Monte Carlo tail risk",
    "xChat quant prompts",
    "xOptions Greeks"
  ],
  alternates: {
    canonical: "/resources/quant-trader-guide"
  },
  openGraph: {
    title: "Quant Trader Guide | Greeks & Monte Carlo Workflows",
    description:
      "Use xFinance Quant Trader desk, xOptions Greeks, and quant-trader xChat prompts for book-level tail risk and exposure analysis.",
    type: "article"
  }
};

type FeatureCallout = {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

type PromptItem = {
  n: number;
  prompt: string;
  exampleOutput: string;
  stackNote: string;
};

type PromptGroup = {
  id: string;
  title: string;
  subtitle?: string;
  items: PromptItem[];
};

const GREEK_FEATURES: FeatureCallout[] = [
  {
    title: "Quant Trader desk (`/xoptions/quant-trader`)",
    body:
      "Monte Carlo tail-risk across owned portfolios — 1D VaR/CVaR (95%), P(drawdown > threshold), drawdown gates, and a per-symbol Greeks exposure heatmap (Δ/Γ notional, Θ/day, vega per IV point). Export CSV/PDF or hand off to xChat.",
    href: "/xoptions/quant-trader",
    hrefLabel: "Open Quant Trader desk"
  },
  {
    title: "Greeks exposure rollup (book level)",
    body:
      "After each simulation, holdings are rolled up into delta-notional, gamma-notional, daily theta USD, and vega-per-IV-point — color-coded for quick long/short and decay reads. Same engine backs the monte_carlo_tail_risk tool in xChat.",
    href: "/xoptions/quant-trader",
    hrefLabel: "Run simulation"
  },
  {
    title: "xOptions chain & strategy Greeks",
    body:
      "In the strategy builder, chain rows show per-contract delta (and toggled Greeks on mobile). When you pick a leg, the footer Greek summary shows net delta (shares), net theta/day, net vega/1% IV, and net gamma with a gamma-risk flag above threshold.",
    href: "/xoptions",
    hrefLabel: "Open xOptions"
  },
  {
    title: "Payoff chart + Black–Scholes reference",
    body:
      "Single-leg payoff overlays use the same European Black–Scholes model as desk Greeks. Expand the Greek explainer on contract steps for Δ, Γ, Θ, and vega formulas when you need to sanity-check chain marks.",
    href: "/xoptions",
    hrefLabel: "Build a structure"
  },
  {
    title: "xChat quant-trader persona + tools",
    body:
      "Select the quant-trader persona (multi-agent, heavy reasoning). Server preflight injects workspace summary and book snapshot; tools include monte_carlo_tail_risk, strategy_recommendations, options_scan (delta/IV/OI filters), and yahoo_finance.",
    href: "/xchat",
    hrefLabel: "Open xChat"
  },
  {
    title: "Portfolio holdings Greeks proxy",
    body:
      "Portfolio desk rows can surface Black–Scholes desk proxies on options holdings — aligned with the quant-trader exposure rollup when you reconcile book-level risk outside xOptions."
  }
];

const PROMPT_GROUPS: PromptGroup[] = [
  {
    id: "monte-carlo",
    title: "Monte Carlo & tail risk",
    subtitle: "Start here for book-level VaR, CVaR, and drawdown gates.",
    items: [
      {
        n: 1,
        prompt:
          "Run a Monte Carlo tail-risk simulation on my 45-day wheel and covered-call book across all portfolios. IV rank > 60%, max 15% drawdown, 12,000 paths. Use each portfolio's desk risk profile.",
        exampleOutput: `MONTE CARLO TAIL-RISK — COMBINED BOOK (illustrative)

Scope: 3 owned portfolios · horizon 45d · paths 12,000 · IV rank floor 60%

Combined (weighted)
• 1D VaR (95%): 2.8%
• 1D CVaR (95%): 4.1%
• P(drawdown > 20%): 6.2%

Per portfolio
Book          VaR 1D   CVaR 1D   P(DD>20%)   Gate
Taxable       3.1%     4.5%      7.1%        Pass
IRA growth    2.2%     3.4%      4.8%        Pass
Spec sleeve   4.6%     6.8%      11.3%       Review

Greeks exposure (top symbols)
Symbol   Δ notional   Γ notional   Θ/day    Vega/IV pt
MEGA     +$42,100     +$8,200      −$186    +$1,240
ORBIT    −$18,400     +$3,100      +$92     +$680

Educational model output — verify at custodian before sizing.`,
        stackNote:
          "Mirrors the Quant Trader desk defaults. Preflight workspace JSON should list portfolio ids — no need to paste holdings. Pair with Export PDF on the desk for committee packets."
      },
      {
        n: 2,
        prompt:
          "Stress my active workspace portfolio only: 30-day horizon, conservative risk tier, max 10% drawdown, min IV rank 50%. Show per-path drawdown gate and combined Greeks rollup.",
        exampleOutput: `SINGLE-BOOK STRESS — CONSERVATIVE (illustrative)

Active: Taxable growth · horizon 30d · tier conservative

Tail metrics
• 1D VaR (95%): 1.9% · CVaR: 2.7%
• Drawdown gate (10% max): P(DD > 10%) = 3.4% → Pass

Greeks rollup highlights
• Net short-vol theta: +$214/day (premium collection sleeve)
• Largest vega: LEAP call overlay on LYRA (+$2.1k / IV pt)

Next: if gate fails, trim concentrated short puts or add defined-risk spreads.`,
        stackNote:
          "Use when the workspace cookie points at one book. Explicit conservative tier overrides per-portfolio desk mapping."
      },
      {
        n: 3,
        prompt:
          "Compare tail risk across my portfolios side by side. Same 45-day horizon and IV rank floor, but show which book fails a 15% drawdown gate and why.",
        exampleOutput: `CROSS-BOOK COMPARE — DRAWdown GATE (illustrative)

| Book        | VaR 1D | CVaR 1D | P(DD>15%) | Gate   | Driver                          |
|-------------|--------|---------|-----------|--------|---------------------------------|
| Taxable     | 2.4%   | 3.6%    | 5.1%      | Pass   | Diversified CC + CSP ladder     |
| Roth        | 1.8%   | 2.5%    | 2.9%      | Pass   | Lower beta, less short vol      |
| Spec        | 5.2%   | 7.9%    | 18.4%     | Fail   | Stacked short puts on 2 names   |

Committee read: Spec sleeve concentrates gamma/short vol — consider defined-risk rolls or hedge overlay.`,
        stackNote:
          "Forces portfolioScope: all with perPortfolioRisk. Ask for methodology citation if numbers look surprising."
      }
    ]
  },
  {
    id: "greeks",
    title: "Greeks & exposure",
    subtitle: "Book-level and leg-level — tie prompts to heatmaps and chain context.",
    items: [
      {
        n: 4,
        prompt:
          "Summarize my current options Greeks exposure across all holdings: net delta in share equivalents, daily theta P&L, vega to a +5 vol point shock, and flag any gamma concentration above desk threshold.",
        exampleOutput: `GREEKS EXPOSURE SUMMARY (illustrative)

Book-level (options + stock delta proxy)
• Net Δ: +1,240 sh equivalent (~+0.31 β-adjusted notional vs $4.0M book)
• Θ/day: +$318 (short premium sleeve dominates)
• Vega (+5 vol pts): −$4,850 (net long vol via LEAPs)

Concentration flags
• ORBIT short puts: Γ notional elevated — roll or define risk before expiry week
• VECT LEAP + short call: positive Θ, negative vega into earnings

Threshold note: gamma-risk warning when |net Γ/share| > 0.05 on a leg cluster.`,
        stackNote:
          "Pulls from monte_carlo_tail_risk greeksExposure and/or holdings rollup. Cross-check leg picks in xOptions Greek summary before sending orders."
      },
      {
        n: 5,
        prompt:
          "For my TSLA wheel position: show net delta, theta, and vega after adding a 0.25-delta short put at 45 DTE. Include payoff sketch and breakeven vs current spot.",
        exampleOutput: `WHEEL LEG — GREEKS WHAT-IF (illustrative)

Underlying: TSLA @ $248 (example)
New leg: short put 45 DTE, |Δ| ≈ 0.25, credit $4.10

Net after leg (book slice)
• Δ: +820 sh eq → +620 sh eq
• Θ/day: +$142 → +$198
• Vega/1% IV: −$890 → −$1,240

Payoff (short put only)
• Max profit: premium · breakeven ≈ strike − credit
• Max loss: strike − credit (assignment path)

Open in xOptions to confirm chain mid and spread before entry.`,
        stackNote:
          "Combines yahoo_finance quote with structure reasoning. Append “Open in xOptions” for handoff to payoff chart + Greek summary footer."
      },
      {
        n: 6,
        prompt:
          "Which symbols in my book are driving negative theta or positive vega this week? Rank by absolute daily theta USD and note any earnings within 7 days.",
        exampleOutput: `THETA / VEGA DRIVERS — 7D WINDOW (illustrative)

| Symbol | Θ/day USD | Vega/IV pt | Earnings ≤7d | Note              |
|--------|-----------|------------|--------------|-------------------|
| PULSE  | +$96      | −$420      | Yes (Apr 24) | Short strangle    |
| ARC    | −$88      | +$1,100    | No           | Long LEAP call    |
| NEXUS  | +$54      | −$310      | No           | CSP ladder        |

Action draft: reduce gamma into PULSE event or convert to defined-risk iron condor.`,
        stackNote:
          "Uses greeksExposure rows sorted by magnitude. Name symbols explicitly if you want cleaner tool grounding."
      }
    ]
  },
  {
    id: "scans",
    title: "Delta-scoped chain scans",
    subtitle: "xChat options_scan understands delta, DTE, IV, OI, and bid filters.",
    items: [
      {
        n: 7,
        prompt:
          "Run an options_scan on RDW: CSP puts, DTE <= 7, delta 0.15–0.30, IV > 40%, OI > 500, bid > 0.10. Rank by capital efficiency and conflict with my holdings.",
        exampleOutput: `OPTIONS_SCAN — RDW PUTS (illustrative)

| Expiry | Strike | Δ     | IV    | OI   | Bid  | Collateral/sh |
|--------|--------|-------|-------|------|------|---------------|
| Apr 26 | $12    | −0.22 | 48%   | 1.2k | 0.18 | ~$1,200       |
| May 03 | $11    | −0.18 | 44%   | 890  | 0.14 | ~$1,100       |

Holdings conflict: none on RDW short puts.
Capital note: size to ≤5% book per IPS.`,
        stackNote:
          "Natural-language query maps to structured filters in options_scan. Delta band is the primary strike selector for income desks."
      },
      {
        n: 8,
        prompt:
          "Scan my watchlist for covered call candidates: 30–45 DTE, call delta 0.25–0.35, names I already own > 200 shares. Show premium yield on shares and assignment risk into ex-div.",
        exampleOutput: `CC SCAN — OWNED NAMES (illustrative)

| Symbol | Shares | Call strike | Δ    | DTE | Credit | Yield*  | Ex-div flag |
|--------|--------|-------------|------|-----|--------|---------|-------------|
| LYRA   | 400    | $48         | 0.28 | 38  | $1.05  | ~2.3%   | None        |
| VANT   | 300    | $135        | 0.31 | 42  | $3.80  | ~2.9%   | May 12      |

*Yield ≈ credit / spot for window — not annualized guarantee.`,
        stackNote:
          "Requires watchlist + positions in preflight. Delta band keeps calls OTM enough for income but not lottery tickets."
      }
    ]
  },
  {
    id: "methodology",
    title: "Methodology & handoff",
    subtitle: "Transparency, structure ranking, and desk → xChat → strategy jobs.",
    items: [
      {
        n: 9,
        prompt:
          "How did you calculate the 1D VaR and CVaR in the last Monte Carlo run? Explain the shock model, path count, correlation assumptions, and IV sourcing.",
        exampleOutput: `METHODOLOGY — monte_carlo_tail_risk (illustrative summary)

Engine
• Student-t shocks (ν≈6) with base correlation ρ≈0.35; stress slice ρ→0.85
• Poisson jumps λ≈1.5 · 10k–12k paths · horizon from request
• IV from Yahoo chains; IV rank gate applied pre-simulation

Metrics
• VaR/CVaR reported as positive loss magnitudes at 95%
• Drawdown prob from path-wise peak-to-trough vs threshold

Cite: quant-trader RAG segment (monte-carlo-engine.md) when file_search is enabled.`,
        stackNote:
          "quant-trader persona should retrieve category=quant-trader KB docs — not invent parameters. Run after prompt #1–3 for audit trails."
      },
      {
        n: 10,
        prompt:
          "After tail-risk passes, rank wheel and bull put spread structures on my top watchlist names for balanced outlook, 45 DTE, matching my desk risk profile. Include expected theta and max defined risk per structure.",
        exampleOutput: `STRUCTURE RANKING — POST-MC (illustrative)

| Rank | Symbol | Structure        | Max risk | Θ/day est | Thesis        |
|------|--------|------------------|----------|-----------|---------------|
| 1    | MEGA   | CSP 0.25Δ        | $4.2k    | +$18      | Neutral-bull  |
| 2    | ORBIT  | Bull put spread  | $1.8k    | +$11      | Support hold  |
| 3    | NEXUS  | Skip             | —        | —         | Earnings 5d   |

Handoff: Save as Strategy Job or open xOptions Hardcore builder for leg review.`,
        stackNote:
          "Calls strategy_recommendations after monte_carlo_tail_risk when gates pass. Numbers must come from tool JSON only."
      }
    ]
  }
];

const PRO_TIPS: string[] = [
  "Select the quant-trader persona in xChat before pasting — preflight + tool routing differ from generic advisor.",
  "Start on the Quant Trader desk for a visual distribution chart and Greeks heatmap, then use Apply to xChat for narrative follow-ups.",
  "Always state portfolio scope: “all portfolios” vs active workspace — avoids clarification loops.",
  "Delta bands in prompts (0.15–0.30 puts, 0.25–0.35 calls) align with options_scan and desk conventions.",
  "After any MC run, ask for methodology if you need audit-grade transparency for committees.",
  "Reconcile Greek summaries to custodian marks — chain IV and mids move intraday."
];

export default async function ResourcesQuantTraderGuidePage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/resources/quant-trader-guide")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Quant Trader guide",
        railVariant: "workspace-product"
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="Quant Trader guide">
        <div className="mb-6 text-sm">
          <Link href="/resources/guides" className="text-[var(--xf-gain-green)] hover:underline">
            ← Back to Guides
          </Link>
        </div>

        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Quant · Greeks</p>
          <h1 className="resources-doc-hero__title">Quant Trader guide</h1>
          <p className="resources-doc-hero__copy">
            Monte Carlo tail-risk, book-level Greeks exposure, and delta-scoped scans — wired through{" "}
            <Link href="/xoptions/quant-trader">Quant Trader desk</Link>,{" "}
            <Link href="/xoptions">xOptions</Link> chain/strategy Greeks, and the{" "}
            <Link href="/xchat">quant-trader xChat persona</Link>. Copy prompts below; review before Send.
          </p>
        </header>

        <nav className="resources-doc-nav" aria-label="Guide sections">
          <a className="resources-doc-nav__chip" href="#features">
            Features
          </a>
          <a className="resources-doc-nav__chip" href="#workflow">
            Workflow
          </a>
          {PROMPT_GROUPS.map((group) => (
            <a key={group.id} className="resources-doc-nav__chip" href={`#${group.id}`}>
              {group.title.split(" ")[0]}
            </a>
          ))}
          <a className="resources-doc-nav__chip" href="#pro-tips">
            Tips
          </a>
        </nav>

        <section className="resources-doc-section" id="features">
          <h2>Platform features using Greeks</h2>
          <p className="resources-doc-section__desc">
            xFinance treats Greeks as first-class desk inputs — not decorative chain columns. Black–Scholes
            (European) powers chain marks, strategy summaries, payoff overlays, portfolio proxies, and the Quant
            Trader exposure heatmap.
          </p>
          <div className="resources-doc-grid">
            {GREEK_FEATURES.map((feature) => (
              <div className="resources-doc-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                {feature.href ? (
                  <p className="mt-2 text-sm">
                    <Link href={feature.href} className="text-[var(--xf-gain-green)] hover:underline">
                      {feature.hrefLabel ?? "Open"} →
                    </Link>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <p className="resources-doc-footnote">
            <span className="xf-disclaimer-emphasis">Not financial advice.</span> Greeks and simulations are
            model-based; verify against your custodian and compliance policy.
          </p>
        </section>

        <section className="resources-doc-section" id="workflow">
          <h2>Suggested workflow</h2>
          <ol className="resources-doc-list">
            <li>
              <strong>Quant Trader desk</strong> — run MC with IV rank + drawdown gates; read VaR/CVaR and Greeks
              heatmap.
            </li>
            <li>
              <strong>xOptions</strong> — drill into legs; confirm net delta/theta/vega on the structure footer and
              payoff chart.
            </li>
            <li>
              <strong>xChat (quant-trader)</strong> — paste prompts for narrative, scans, methodology, or structure
              ranking; export PDF/CSV from desk for records.
            </li>
            <li>
              <strong>Strategy job</strong> — save validated structures when your deployment enables Hardcore jobs.
            </li>
          </ol>
        </section>

        {PROMPT_GROUPS.map((group) => (
          <section className="resources-doc-section" id={group.id} key={group.id}>
            <h2>{group.title}</h2>
            {group.subtitle ? (
              <p className="resources-doc-section__desc text-[var(--xf-text-300)]">{group.subtitle}</p>
            ) : null}
            <div className="space-y-5">
              {group.items.map((item) => (
                <div
                  className="rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-surface-700)_85%,transparent)] p-4 sm:p-5"
                  key={item.n}
                >
                  <p className="m-0 font-mono text-[0.72rem] font-semibold uppercase tracking-wider text-[var(--xf-gain-green)]">
                    #{item.n}
                  </p>
                  <blockquote className="mt-2 border-l-2 border-[color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)] pl-3 text-sm leading-relaxed text-[var(--xf-text-100)]">
                    {item.prompt}
                  </blockquote>
                  <div className="mt-3">
                    <p className="resources-doc-example-output__label">Expected high-value output</p>
                    <pre className="resources-doc-example-output">{item.exampleOutput}</pre>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--xf-text-300)]">
                    <span className="font-semibold text-[var(--xf-text-200)]">Stack note: </span>
                    {item.stackNote}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="resources-doc-section" id="pro-tips">
          <h2>Pro tips</h2>
          <ul className="resources-doc-list">
            {PRO_TIPS.map((tip, idx) => (
              <li key={`quant-tip-${idx}`}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="resources-doc-section" id="related">
          <h2>Related guides</h2>
          <p className="resources-doc-section__desc">
            <Link href="/resources/top-10-hnwi-xchat-prompts">Top 10 HNWI xChat prompts</Link> for general income
            playbooks · <Link href="/resources/options-risk-management-frameworks">Risk frameworks</Link> for tier
            guardrails · <Link href="/resources/multi-portfolio-management-hnwi">Multi-portfolio HNWI</Link> for
            scoped books.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xoptions/quant-trader">Open Quant Trader desk →</Link>
            {" · "}
            <Link href="/xchat">Open xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve substantial risk. Prompts and simulations do not guarantee outcomes; verify every
            recommendation against your mandate and custodian records.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader
          current="xchat"
          feedbackPageLabel="Resources · Quant Trader guide"
          session={session}
        />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={workspaceProductRail} railChrome="workspace-product">
            {shellContent}
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref} rail={workspaceProductRail ?? undefined}>
            {shellContent}
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
