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
  note: string;
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
        note:
          "Triggers scanner-style reasoning plus portfolio integration when tools succeed. Aim for a ranked table and xOptions handoff links when your tenant enables them."
      },
      {
        n: 2,
        prompt:
          "Analyze my portfolio for covered call opportunities this month. Prioritize quality underlyings I already own over 2%. Suggest strikes, premiums, and rolling logic with tax considerations.",
        note:
          "Leverages holdings context and balanced-income framing; outputs should tie to symbols you actually hold in the active workspace."
      },
      {
        n: 3,
        prompt:
          "Give me my current portfolio risk summary: max drawdown scenarios, sector concentration, and a defensive options hedge package under conservative outlook for next 90 days.",
        note:
          "Strong quarterly-review shape; pulls multi-book context when you scope “across portfolios” or switch workspace."
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
        note:
          "Forces multi-strategy synthesis; ask for charts explicitly when you want structured visuals in the reply."
      },
      {
        n: 5,
        prompt:
          "Build me a diversified monthly income ladder using options across my portfolios. Target 0.8–1.2% monthly yield with defined risk. Suggest position sizes and expiration stagger.",
        note:
          "Pairs well with calendar-style thinking; structured / job-style exports depend on deployment (strategy jobs path when enabled)."
      },
      {
        n: 6,
        prompt:
          "Review my IBKR positions (or current snapshot) and suggest tax-efficient options overlays for the next quarter. Flag any wash-sale risks and replacement strategies.",
        note:
          "Uses IBKR-linked snapshots when Client Portal session is connected; otherwise falls back to Mongo portfolio positions in workspace."
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
        note:
          "Bias aggressive outlook; ensure persona/RAG scope matches your tenant’s published strategy material."
      },
      {
        n: 8,
        prompt:
          "Identify 3–5 high-conviction options trades for earnings season from my watchlist. Include strangles, iron condors, or directional debit spreads with full risk/reward and timing.",
        note:
          "Event-driven flow; combine with explicit symbols and dates for cleaner tool use."
      },
      {
        n: 9,
        prompt:
          "Stress test my entire book against a 15% market drop and a 20% VIX spike. Recommend options adjustments to maintain <8% portfolio risk while keeping income flow.",
        note:
          "Advanced scenario framing; outputs are illustrative until validated against your IPS and broker constraints."
      },
      {
        n: 10,
        prompt:
          "Create a custom 2026 options income playbook for my [portfolio size] portfolio. Split conservative 60%, balanced 30%, aggressive 10%. Include monthly targets, watchlist additions, and automation rules for xOptions.",
        note:
          "Highest leverage synthesis prompt — pair with export/share flows when productized; replace bracket with your actual AUM band."
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
                  <p className="mt-3 text-sm leading-relaxed text-[var(--xf-text-300)]">
                    <span className="font-semibold text-[var(--xf-text-200)]">Expected high-value output: </span>
                    {item.note}
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
