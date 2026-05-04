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
  title: "Top 10 HNWI xChat Prompts | aTx Trusted Advisory | Resources",
  description:
    "Production-grade xChat prompt patterns for HNWI books: conservative, balanced, and aggressive biases. Portfolio context, xOptions handoff, IBKR snapshots when linked — engineered for the full aTx Advisor stack.",
  keywords: ["HNWI xChat prompts", "options prompts aTx Advisor", "xChat workspace prompts", "conservative options prompts"],
  alternates: {
    canonical: "/resources/top-10-hnwi-xchat-prompts",
  },
  openGraph: {
    title: "Top 10 HNWI xChat Prompts | aTx Trusted Advisory | Resources",
    description:
      "Production-grade xChat prompt patterns for HNWI books — conservative through aggressive — with portfolio-scoped guardrails.",
    type: "article",
  },
};

type PromptItem = {
  n: number;
  prompt: string;
  /** Synthetic excerpt — shape of a strong reply; not a logged model trace. */
  exampleOutput: string;
  /** How this connects to workspace tools, persona scope, and handoff surfaces. */
  stackNote: string;
};

type PromptGroup = {
  id: string;
  title: string;
  subtitle?: string;
  items: PromptItem[];
};

const PROMPT_GROUPS: PromptGroup[] = [
  {
    id: "conservative",
    title: "Conservative income & protection focus",
    subtitle: "Prioritize these first.",
    items: [
      {
        n: 1,
        prompt:
          "Run a full conservative CSP wheel scan on my entire watchlist and current holdings. Use 30–45 DTE, 0.2–0.3 delta, max 5% of portfolio per name. Show probability of profit, capital efficiency, and conflict with existing positions.",
        exampleOutput: `CONSERVATIVE CSP / WHEEL — RANKED (illustrative)

Symbol   Role      DTE   Short put Δ   Est. PoP*   Max alloc   Conflict check
MEGA     CSP leg   38d   0.26          ~71%        4.1% book   OK vs cash / no duplicate short
ORBIT    CSP leg   44d   0.22          ~76%        3.8% book   Flag: earnings in 12d
NEXUS    Skip      —     —             —           —           Already short puts @ similar strike

*Model / chain dependent — verify on live quotes before sizing.

Next actions
• Confirm BP / margin per name at custodian
• If filled: wheel transition rules (roll at 21 DTE or 50% premium)

Open in xOptions (when enabled): pre-fill short put leg from row #1 for review only.`,
        stackNote:
          "Triggers scanner-style reasoning plus holdings/watchlist context when tools succeed; expect a ranked table and optional xOptions handoff when your tenant enables it."
      },
      {
        n: 2,
        prompt:
          "Analyze my portfolio for covered call opportunities this month. Prioritize quality underlyings I already own over 2%. Suggest strikes, premiums, and rolling logic with tax considerations.",
        exampleOutput: `COVERED CALLS — WORKSPACE HOLDINGS (illustrative)

Name   Shares   Cost basis band   CC strike (Oct expiry)   Est. credit   Yield on shares*
LYRA   400      $42–44           $48 (≈0.30 Δ call)        $1.10/sh      ~2.5% / 30d window*
VANT   200      $118–122         $135 (≈0.28 Δ)            $4.20/sh      ~3.4%

*Educational estimate — premiums from chain at scan time.

Rolling / management
• Roll up/out if short call ≥ 0.65 Δ before expiry
• Tax: note qualified vs non-qualified lots if mixing accounts

Educational only — not tax advice; confirm lots with your CPA / custodian.`,
        stackNote:
          "Uses portfolio positions from the active workspace; names and strikes should map to symbols you actually hold, not generic tickers."
      },
      {
        n: 3,
        prompt:
          "Give me my current portfolio risk summary: max drawdown scenarios, sector concentration, and a defensive options hedge package under conservative outlook for next 90 days.",
        exampleOutput: `90-DAY RISK SNAPSHOT — CONSERVATIVE (illustrative)

Book makeup (example)
• Equity ~68% · Cash ~12% · Options net ~8% · Other ~12%
• Top sector sleeves: Tech 22%, Industrials 14%, Healthcare 11%

Scenario lens
• Spot −10%: est. book impact range −6% to −9% (delta / beta sketch)
• Spot −15%: stress band widens if single-name >8% of book

Defensive package (draft)
1) Index / ETF hedge: consider defined-risk put spread on broad benchmark vs book beta
2) Single-name floors: protective put or collar on top 2 concentration names
3) Income dampener: lighten short-vol overlap where CSP + CC stack same symbol

Verification checklist
• Refresh Greeks after any hedge leg
• Align notionals to IPS max loss / liquidity floors`,
        stackNote:
          "Quarterly-review shape; scope “across portfolios” or switch workspace book so concentration math matches your real sleeves."
      }
    ]
  },
  {
    id: "balanced",
    title: "Balanced / hybrid income + growth",
    items: [
      {
        n: 4,
        prompt:
          "Compare wheel vs covered call vs poor man’s covered call on my top 5 holdings/watchlist names for the next 60 days. Include payoff diagrams, breakeven, and capital requirement under balanced outlook.",
        exampleOutput: `STRATEGY COMPARE — 60D BALANCED (illustrative, one name)

Underlying: LYRA @ $46 (example)

Structure          Capital @ risk / tie-up   Breakeven sketch      Best when
Wheel (CSP→CC)     Cash-secured ~$4.6k/sh    Put side ~$41 net     Income + willing to own shares
Covered call       Own 100 shares           Downside to cost basis  Already long stock; clip calls
PMCC               LEAP debit + short call    LEAP premium + rolls  Bullish / vol-aware; manage roll risk

Payoff (describe in prose / ASCII sketch)
Wheel: “truncated downside to assignment, capped upside when shares called away…”
PMCC: “long-dated call replaces stock; short call finances theta…”

Ask the model to attach a simple payoff diagram or bullet max-profit / max-loss if your UI supports images.`,
        stackNote:
          "Forces multi-strategy synthesis; append “include payoff sketch” if you want diagrams or structured max/min tables."
      },
      {
        n: 5,
        prompt:
          "Build me a diversified monthly income ladder using options across my portfolios. Target 0.8–1.2% monthly yield with defined risk. Suggest position sizes and expiration stagger.",
        exampleOutput: `MONTHLY INCOME LADDER — DEFINED RISK (illustrative)

Target sleeve yield band: 0.8–1.2% / month on dedicated income tranche (not whole net worth).

Week   Primary structure      Book % of income tranche   Expiry cluster
T1     Bull put spread        18%                        3rd Friday +7d
T2     Iron condor (RUT-like) 14%                        3rd Friday +14d
T3     Covered call rolling   22%                        serial weeklies on 2 names
T4     Cash buffer / hedge    10%                        long put spread hedge

Risk rails
• Max loss per structure capped at X% of income tranche
• No single underlying >25% of ladder notional

Automation (when jobs/tools ship): export legs as watch alerts + review queue — never fire-and-forget.`,
        stackNote:
          "Pairs with calendar / staggered expiry discipline; heavy structuring may route through strategy-job flows when your deployment enables them."
      },
      {
        n: 6,
        prompt:
          "Review my IBKR positions (or current snapshot) and suggest tax-efficient options overlays for the next quarter. Flag any wash-sale risks and replacement strategies.",
        exampleOutput: `IBKR SNAPSHOT OVERLAY PLAN — Q NEXT (illustrative)

Positions flagged from snapshot (examples)
• Stock LOT A — short-term gain if closed now
• Option LOT B — expired worthless last month (document for records)

Overlay ideas (draft)
• Delay closing LOT A until LT bucket if mandate allows; pair with collar if downside risk rises
• Replace washed symbol with broad ETF exposure only if policy permits — watch 30-day window

Wash-sale watchlist
• Avoid repurchase of “substantially identical” tickers within window after loss harvest
• Options on same CUSIP underlying can still trigger complexity — verify with custodian report

Disclaimer block you want in replies
“Educational overlay ideas — confirm tax lots and wash rules with your CPA / IBKR tax reports.”`,
        stackNote:
          "Uses IBKR-linked snapshots when Client Portal OAuth is live; otherwise aligns to Mongo portfolio rows in your workspace."
      }
    ]
  },
  {
    id: "aggressive",
    title: "Aggressive / tactical outlook",
    items: [
      {
        n: 7,
        prompt:
          "Run aggressive LEAP + CSP collar strategies on my growth names. Target 15–25% upside participation with income. Show Greeks, volatility skew, and assignment scenarios.",
        exampleOutput: `LEAP + CSP / COLLAR — AGGRESSIVE GROWTH NAME (illustrative)

Structure
• Long LEAP call 12–18mo, Δ ~0.75
• Short OTM calls (monthlies) to finance theta
• Optional CSP tranche if willing to add shares on pullback

Greeks (directional read)
• Net delta target band +0.35 to +0.55 after overlays
• Vega: long LEAP carries vega — short calls bleed vega into events

Skew / assignment
• If put assigned: convert wheel leg or stock replacement plan
• If short call ITM pre-div: early assignment risk note on calls

Risk cap
• Define max premium outlay on LEAP as % of speculative sleeve only`,
        stackNote:
          "Aggressive persona bias; keep tenant RAG / published playbooks aligned so language matches your compliance-approved strategy library."
      },
      {
        n: 8,
        prompt:
          "Identify 3–5 high-conviction options trades for earnings season from my watchlist. Include strangles, iron condors, or directional debit spreads with full risk/reward and timing.",
        exampleOutput: `EARNINGS TRADE MENU — ILLUSTRATIVE

Symbol   Event date   Structure             Max risk    Max reward   Edge / thesis
PULSE    Apr 24       Short iron condor     $420/lot    $580/lot     IV crush + range bound
ARC      May 02       Long strangle         $680/lot    Uncapped*    Vol expansion bet
VECT     May 09       Put debit spread      $250/lot    $750/lot     Directional miss guide

*Uncapped risk on one leg — define stop.

Timing
• Enter 3–5 sessions before close unless vol term skew argues earlier
• Exit rule: 50% winner or day-before if gamma risk spikes

Always pass explicit symbols + earnings dates in your prompt for cleaner tool grounding.`,
        stackNote:
          "Event-driven; naming symbols and confirmed earnings dates reduces hallucination and improves quote-aware reasoning."
      },
      {
        n: 9,
        prompt:
          "Stress test my entire book against a 15% market drop and a 20% VIX spike. Recommend options adjustments to maintain <8% portfolio risk while keeping income flow.",
        exampleOutput: `STRESS MATRIX — BOOK LEVEL (illustrative)

Shock A: Spot −15%
• Delta-adjusted loss band: −X% to −Y%
• Largest contributors: [top 3 names]

Shock B: VIX +20 pts (fast)
• Short-vol sleeves marked-to-loss first
• Income structures to review: naked ratio spreads, concentrated CSP stacks

Adjustment playbook (draft)
1) Trim overlapping short puts on same beta bucket
2) Add cheap tail hedge (put fly / put ladder) sized to ≤0.4% drag / quarter
3) Convert a portion of naked risk to defined-risk spreads

Target: portfolio risk metric <8% of book per your definition — restate metric (VaR / max DD) in prompt.`,
        stackNote:
          "Advanced scenario framing; numbers are illustrative until reconciled to your IPS, custodian risk reports, and actual Greeks."
      },
      {
        n: 10,
        prompt:
          "Create a custom 2026 options income playbook for my [portfolio size] portfolio. Split conservative 60%, balanced 30%, aggressive 10%. Include monthly targets, watchlist additions, and automation rules for xOptions.",
        exampleOutput: `2026 OPTIONS PLAYBOOK — THREE-TIER (illustrative template)

Assumed book bands (replace with yours): $2M–$5M liquid investable; income sleeve 35%.

Allocation spine
• Conservative 60% — CSP / CC ladders, tight single-name caps
• Balanced 30% — spreads + selective earnings premium
• Aggressive 10% — LEAP overlays / tactical calls on high-conviction names

Monthly rhythm
• Week 1: roll / close expiries + refresh ladder
• Week 2: scan watchlist for new CSP candidates
• Week 3: review hedges vs macro shock scenarios
• Week 4: tax-lot + wash-sale hygiene check

Automation hooks (xOptions / jobs when enabled)
• Alert: short put Δ > 0.45
• Alert: earnings inside 7d with open short premium

Replace [portfolio size] with your AUM band so sizing math scales.`,
        stackNote:
          "Highest-leverage synthesis — pair with export / task flows when productized; bracket placeholder must be your real band for actionable sizing."
      }
    ]
  }
];

const PRO_TIPS: string[] = [
  "Always prefix with portfolio context when needed: “Using my main taxable portfolio and IRA…” → reinforces correct DB scoping.",
  "Ask for visuals & handoff: end with “Include payoff summaries and Open in xOptions where applicable.”",
  "Risk tier control: add “conservative / balanced / aggressive outlook” to steer persona-aligned framing.",
  "Multi-book power: “Across all my portfolios…” → forces explicit workspace discipline.",
  "Follow-up chain: after a strong answer, try “Summarize this as bullet actions” or “What should I verify before sending orders?”",
  "Vision paste: screenshot a chain or holdings table and paste for Grok-style review when your workflow allows images."
];

export default async function ResourcesTop10HnwiXchatPromptsPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/resources/top-10-hnwi-xchat-prompts")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Top 10 HNWI prompts",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="Top 10 HNWI xChat prompts">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · xChat · HNWI</p>
          <h1 className="resources-doc-hero__title">Top 10 HNWI xChat Prompts for aTx Trusted Advisory</h1>
          <p className="resources-doc-hero__copy">
            Beyond the baseline “Show me CSP ideas for my watchlist” — patterns designed to engage portfolio DB context,
            persona-linked RAG where published, optional IBKR snapshots, multi-book outlooks, and handoff toward{" "}
            <Link href="/xoptions">xOptions</Link> when your role and tenant enable those surfaces.
          </p>
        </header>

        <section className="resources-doc-section" id="stack">
          <h2>What these prompts are meant to trigger</h2>
          <p className="resources-doc-section__desc">
            Well-scoped prompts align with the full stack when available: Grok-backed xChat, tool calls into holdings and
            watchlists, persona/RAG collections such as{" "}
            <span className="font-mono text-[0.85rem] text-[var(--xf-text-300)]">options-coreskills</span> where linked,
            multi-agent routing only where product policy enables it — never silent escalation. Strategy engines and
            strategy-job orchestration vary by deployment; treat outputs as <strong>draft</strong> until you reconcile to
            custodian and compliance.
          </p>
          <p className="resources-doc-footnote">
            Educational patterns; not individualized advice. Capabilities depend on plan, tenant, and integration flags.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--full">
            <strong>About the examples below:</strong> each &quot;Expected high-value output&quot; block is a{" "}
            <strong>synthetic illustration</strong> of structure and sections — not a transcript, quote, or guarantee of
            model behavior. Live replies vary with workspace data, tools, persona, and market prints.
          </p>
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
          <h2>Pro tips for maximum value</h2>
          <p className="resources-doc-section__desc">Architect’s playbook — short checklist:</p>
          <ul className="resources-doc-list">
            {PRO_TIPS.map((tip, idx) => (
              <li key={`pro-tip-${idx}`}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="resources-doc-section" id="more-reading">
          <h2>More reading</h2>
          <p className="resources-doc-section__desc">
            Long-form articles (including eight structured pillars) are linked from the{" "}
            <Link href="/#resources-pillars">public landing page</Link>. In-product guides include{" "}
            <Link href="/resources/secret-sauce">Secret sauce</Link> and{" "}
            <Link href="/resources/from-xchat-to-broker-ibkr">xChat → IBKR workflow</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Open xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve substantial risk. Prompts do not guarantee outcomes or latencies; verify every recommendation
            against your mandate and custodian records.
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
          feedbackPageLabel="Resources · Top 10 HNWI prompts"
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
