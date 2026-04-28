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
import { ExpandableResourceScreenshot } from "../2026-options-income-playbook/expandable-screenshot";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "How xAI Spots Better Wheels Than Most Humans | Resources",
  description:
    "Discover how xAI (Grok) analyzes wheel strategies faster and more accurately than human traders. Real examples, cash-secured put mechanics, and xChat-powered trade review.",
  keywords: [
    "xAI wheel strategy",
    "Grok options trading",
    "better wheel strategy",
    "xAI options income",
  ],
  alternates: {
    canonical: "/resources/how-xai-spots-better-wheels",
  },
  openGraph: {
    title: "How xAI Spots Better Wheels Than Most Humans | Resources",
    description:
      "Discover how xAI (Grok) analyzes wheel strategies faster and more accurately than human traders. Real examples, cash-secured put mechanics, and xChat-powered trade review.",
    type: "article",
  },
};

const WHEEL_VARIANT_ROWS: { label: string; strikes: string; cadence: string; guardrails: string }[] = [
  {
    label: "Conservative",
    strikes: "Further OTM puts/calls; wider cushion to assignment",
    cadence: "Monthly / 45–60 DTE common",
    guardrails: "Lower delta targets; smaller % of book per cycle",
  },
  {
    label: "Aggressive",
    strikes: "Closer OTM; higher premium per cycle",
    cadence: "Weekly / shorter DTE possible",
    guardrails: "Stricter max-loss and roll rules; event awareness",
  },
];

function WheelPayoffSchematic() {
  return (
    <figure className="resources-doc-card mt-3 overflow-hidden p-0">
      <figcaption className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] px-3 py-2 text-[0.78rem] font-semibold text-[var(--xf-text-100)]">
        Illustrative wheel phase payoff (conceptual — not account-specific)
      </figcaption>
      <div className="resources-doc-footnote resources-doc-footnote--full border-b border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] px-3 py-2">
        Short premium phases aim for recurring credit as price oscillates; assignment and calls cap reshape the curve versus stock-only exposure.
      </div>
      <svg
        viewBox="0 0 440 200"
        className="h-auto w-full bg-[color-mix(in_srgb,var(--xf-bg-900)_35%,transparent)]"
        aria-hidden
      >
        <text x="12" y="18" fill="var(--xf-text-400)" fontSize="11">
          P/L (schematic)
        </text>
        <line
          x1="48"
          y1="160"
          x2="400"
          y2="160"
          stroke="var(--xf-text-400)"
          strokeOpacity={0.45}
          strokeWidth="1"
        />
        <line
          x1="48"
          y1="28"
          x2="48"
          y2="160"
          stroke="var(--xf-text-400)"
          strokeOpacity={0.45}
          strokeWidth="1"
        />
        <polyline
          fill="none"
          points="48,120 120,95 200,78 280,88 360,105 400,118"
          stroke="var(--xf-gain-green)"
          strokeWidth="2.25"
        />
        <text x="52" y="182" fill="var(--xf-text-400)" fontSize="10">
          Spot →
        </text>
        <text x="300" y="148" fill="var(--xf-text-400)" fontSize="10">
          Premium phases
        </text>
      </svg>
    </figure>
  );
}

export default async function ResourcesHowXaiSpotsBetterWheelsPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Grok wheel edge",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="How xAI spots better wheel strategies">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · xAI &amp; wheels</p>
          <h1 className="resources-doc-hero__title">How xAI Spots Better Wheels Than Most Humans</h1>
          <p className="resources-doc-hero__copy">
            Discover how xAI (Grok) can analyze wheel-style income setups with breadth and consistency that is hard to
            match manually — without replacing your judgment on risk, tax, and liquidity.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>The human bias problem</h2>
          <p className="resources-doc-section__desc">
            Human traders anchor to recent winners, fight the last war, and skim chains under time pressure. Grok-backed
            workflows in xFinance combine chain-aware reasoning with portfolio context so you compare strikes,
            expirations, and roll paths against your actual book — not a generic screenshot. The strategy-engine lineage
            behind xOptions encodes decades of desk-style checks; paired with Grok, you get faster iteration across
            scenarios than most solo workflows allow.
          </p>
          <p className="resources-doc-footnote">
            Educational article; not individualized advice.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="wheel-mechanics">
          <h2>Wheel mechanics refresher</h2>
          <p className="resources-doc-section__desc">
            The classic wheel rotates between{" "}
            <strong>cash-secured puts</strong> (premium while willing to buy lower) and{" "}
            <strong>covered calls</strong> (premium while holding shares). Assignment transitions you across phases;
            rolls manage transitions without forcing binary decisions at each print.
          </p>
          <p className="resources-doc-section__desc">
            Need the full playbook? See{" "}
            <Link href="/resources/building-wheel">Building a wheel</Link> and{" "}
            <Link href="/resources/getting-started">Getting started with options</Link>.
          </p>
          <WheelPayoffSchematic />
        </section>

        <section className="resources-doc-section" id="secret-sauce">
          <h2>xAI’s edge — scanning, coreskills, and routing</h2>
          <ul className="resources-doc-list">
            <li>
              <strong>IV &amp; liquidity scanning.</strong> Grok can synthesize chain traits (delta bands, open interest,
              spread width) into plain-language trade-offs instead of leaving you to compare tabs blindly.
            </li>
            <li>
              <strong>RAG-backed education.</strong> Persona-linked collections align with your tenant’s published
              narratives — including strategy indexes such as{" "}
              <span className="font-mono text-[var(--xf-text-300)]">options-coreskills</span> risk/outlook framing — so
              answers stay grounded in approved material. See also{" "}
              <Link href="/resources/secret-sauce">Secret sauce</Link>.
            </li>
            <li>
              <strong>Model routing.</strong> Effective chat models follow persona defaults; specialized multi-agent
              flows apply only where product and policy enable them — no silent escalation.
            </li>
          </ul>
        </section>

        <section className="resources-doc-section" id="xchat-demo">
          <h2>Live-style xChat demo (example)</h2>
          <p className="resources-doc-section__desc">
            Paste a screenshot or describe legs in text; Grok can respond with structured bullets tied to your scoped
            workspace when you’re signed in. Illustrative exchange:
          </p>
          <div className="resources-doc-card mt-3 font-mono text-[0.78rem] leading-relaxed text-[var(--xf-text-200)]">
            <p className="m-0 mb-3 border-b border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pb-2 text-[var(--xf-gain-green)]">
              You (example)
            </p>
            <p className="m-0 mb-4">
              Analyze my NVDA wheel: short 30-day CSP 15% OTM, size 5% of book; if assigned, plan covered calls 10%
              OTM weekly. Flag assignment risk into earnings.
            </p>
            <p className="m-0 mb-3 border-b border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pb-2 text-[var(--xf-text-100)]">
              Grok-style outline (illustrative)
            </p>
            <ol className="m-0 list-decimal space-y-2 pl-5">
              <li>Summarize premium vs. capital at risk for the CSP leg.</li>
              <li>Contrast weekly vs. bi-weekly covered-call cadences if shares land.</li>
              <li>List earnings proximity checks and roll triggers you can track in xOptions.</li>
            </ol>
          </div>
          <ExpandableResourceScreenshot src="/landing/xchat.png" alt="xChat conversation workspace (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              Product UI evolves; image is representative. Open <Link href="/xchat">xChat</Link> after sign-in for live use.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="variants">
          <h2>Conservative vs aggressive wheel variants</h2>
          <p className="resources-doc-section__desc">
            Defaults in desk tooling skew conservative on allocation and assignment buffers; you can tighten or loosen
            within your mandate. Representative contrast:
          </p>
          <table className="resources-doc-table" aria-label="Conservative versus aggressive wheel variants">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Strikes</th>
                <th>Cadence</th>
                <th>Guardrails</th>
              </tr>
            </thead>
            <tbody>
              {WHEEL_VARIANT_ROWS.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.strikes}</td>
                  <td>{row.cadence}</td>
                  <td>{row.guardrails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="portfolio-tax">
          <h2>Portfolio impact &amp; tax / liquidity reminders</h2>
          <p className="resources-doc-section__desc">
            Wheels tie up cash or shares; assignment changes basis and may trigger tax events in taxable accounts.
            Liquidity needs (margin, dividends, funding rolls) matter as much as premium printed. Size positions against
            cash buffers and compliance constraints — Grok summarizes scenarios; you approve execution.
          </p>
          <ul className="resources-doc-list">
            <li>Track concentration per ticker vs. policy caps.</li>
            <li>Separate paper gains from cash-flow timing around rolls.</li>
            <li>Use workspace-scoped xChat so prompts align with the portfolio you intend.</li>
          </ul>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Let Grok review your wheel in xChat → Try now</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve risk and may not be suitable for all investors. Past hypothetical examples do not guarantee
            future results.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Grok wheel edge" session={session} />
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
