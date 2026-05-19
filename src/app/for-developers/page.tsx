import type { Metadata } from "next";
import Link from "next/link";

import { GlobalFooter } from "@/app/ui/global-footer";
import { PublicMarketingHeader } from "@/app/ui/public-marketing-header";
import { withUtmParams } from "@/lib/marketing/utm";

export const metadata: Metadata = {
  title: "For Developers & Agents | xFinance MCP & Tools",
  description: "Open MCP server and tools for wiring Grok + desk workflows into your own agents. Portfolio-scoped, tenant-isolated.",
};

export default function ForDevelopersPage() {
  const loginHref = "/login";
  const registerHref = "/account/billing?register=1&plan=basic";

  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)]">
      <PublicMarketingHeader
        loginHref={loginHref}
        registerTrialHref={registerHref}
      />

      <div className="mx-auto max-w-screen-xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[2px] text-[var(--xf-gain-green)]">For developers &amp; agents</p>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight">xfinance-advisor-mcp</h1>
          <p className="mt-4 text-xl text-[var(--xf-text-300)]">
            Open MCP server for wiring Grok and desk tools into your own agents — portfolio-scoped calls, strategy jobs, and market helpers with tenant isolation.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/60 p-8">
            <h3 className="text-xl font-semibold">What you get</h3>
            <ul className="mt-4 space-y-3 text-[var(--xf-text-300)]">
              <li>• Portfolio-scoped tool calls that respect your tenant boundaries</li>
              <li>• Strategy jobs (including Monte Carlo tail-risk)</li>
              <li>• Market data helpers + vision paste support</li>
              <li>• Works with Cursor, Claude, or any MCP-compatible orchestrator</li>
            </ul>
            <a
              href="https://github.com/atxfinance/xfinance-advisor-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex rounded-2xl bg-[var(--xf-gain-green)] px-6 py-3 text-sm font-semibold text-[var(--xf-bg-900)]"
            >
              Open MCP repo ↗
            </a>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/60 p-8">
            <h3 className="text-xl font-semibold">In-product surface</h3>
            <p className="mt-3 text-[var(--xf-text-300)]">
              Use the <span className="font-mono">quant-trader</span> persona in xChat or the dedicated quant desk at{" "}
              <Link href="/xoptions/quant-trader" className="text-[var(--xf-gain-green)] underline">/xoptions/quant-trader</Link>.
            </p>
            <p className="mt-4 text-sm text-[var(--xf-text-400)]">
              Educational simulations and research tools only — not personalized financial advice.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-[var(--xf-text-400)]">
          Need production access? <Link href={registerHref} className="text-[var(--xf-gain-green)]">Start a Basic trial</Link> or{" "}
          <Link href="/#ia-family-office" className="text-[var(--xf-gain-green)]">request a team pilot</Link>.
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
