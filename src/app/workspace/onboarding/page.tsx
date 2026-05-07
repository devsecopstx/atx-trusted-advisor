import { ObjectId } from "mongodb";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import { BillingWelcomeToast } from "@/app/workspace/onboarding/billing-welcome-toast";
import { WorkspaceOnboardingContinue } from "@/app/workspace/onboarding/workspace-onboarding-continue";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { normalizeSubscriptionPlan, SUBSCRIPTION_PLAN_LABELS } from "@/lib/subscription-plan";
import { buildWorkspaceOnboardingCoveredCallPrompt } from "@/lib/workspace-onboarding-prompt";
import { getWorkspaceProductSidebarPropsForSession } from "@/lib/workspace-product-sidebar-server-props";
import { listPortfolioPositionsByAccount } from "@/modules/core-admin/repository";
import type { Position } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";
import { canUserLogin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";

import "@/app/account/billing/billing-plans.css";
import "@/app/xchat/xchat.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome — workspace setup"
};

const CASH_LIKE = /^(CASH|USD|MMDA|SPAXX|FDRXX|TBCXX)$/i;

function pickTopEquitySymbol(positions: Position[]): string | null {
  const scored = positions
    .filter((p) => normalizePositionType(p.type) === "stock")
    .map((p) => {
      const raw = p.symbol?.trim() ?? "";
      const sym = raw.toUpperCase();
      if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(sym) || CASH_LIKE.test(sym)) {
        return null;
      }
      const notion = Math.abs(p.qty) * (Number.isFinite(p.avgCost) ? p.avgCost : 0);
      return { sym, notion };
    })
    .filter((x): x is { sym: string; notion: number } => x != null && x.notion > 0);
  scored.sort((a, b) => b.notion - a.notion);
  return scored[0]?.sym ?? null;
}

export default async function WorkspaceOnboardingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const billingWelcomeRaw = typeof sp.billing_welcome === "string" ? sp.billing_welcome : undefined;
  const billingWelcomeFlag = billingWelcomeRaw === "1" || billingWelcomeRaw === "true";

  const session = await getSessionUser();
  if (!session) {
    redirect("/account/billing?register=1&plan=basic");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/workspace/onboarding");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const book = await loadAppUserDefaultBook(session);
  let topSymbol: string | null = null;
  if (
    book?.portfolioId &&
    book.accountId &&
    ObjectId.isValid(book.portfolioId) &&
    ObjectId.isValid(book.accountId)
  ) {
    const positions = await listPortfolioPositionsByAccount({
      userId: session.userId,
      portfolioId: book.portfolioId,
      accountIds: [new ObjectId(book.accountId)],
      tenantId: session.tenantId
    });
    topSymbol = pickTopEquitySymbol(positions);
  }

  const composerDraft = buildWorkspaceOnboardingCoveredCallPrompt(topSymbol);
  const workspaceRailProps = await getWorkspaceProductSidebarPropsForSession(session, "Welcome");

  let billingWelcomePlanLabel = SUBSCRIPTION_PLAN_LABELS.basic;
  if (ObjectId.isValid(session.userId)) {
    const coreUser = await getCoreUserById(new ObjectId(session.userId));
    const plan = normalizeSubscriptionPlan(coreUser?.subscriptionPlan);
    billingWelcomePlanLabel = SUBSCRIPTION_PLAN_LABELS[plan];
  }

  const addHoldingsHref =
    book?.accountId && ObjectId.isValid(book.accountId)
      ? `/portfolio/accounts/${book.accountId}/add-holdings`
      : "/portfolios";

  return (
    <div className="xchat-shell">
      <BillingWelcomeToast initialVisible={billingWelcomeFlag} planLabel={billingWelcomePlanLabel} />
      <AppUserApprovedHeader current={null} feedbackPageLabel="Welcome" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<WorkspaceProductSidebar {...workspaceRailProps} />}
          railChrome="workspace-product"
        >
          <div className="billing-page max-w-3xl space-y-6">
            <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
              <p className="billing-hero__eyebrow">Quick setup</p>
              <h1 className="billing-hero__title">Your default portfolio is ready</h1>
              <p className="billing-hero__copy">
                Add custodian accounts or positions when you&apos;re ready — or jump straight into xChat. We&apos;ll
                pre-fill a{" "}
                <strong className="text-[var(--xf-gain-green)]">conservative covered-call prompt</strong>
                {topSymbol ? (
                  <>
                    {" "}
                    anchored on your top equity holding (<span className="font-mono">{topSymbol}</span>).
                  </>
                ) : (
                  <> using your largest stock line once holdings are in.</>
                )}
              </p>
            </header>

            <div className="surface-card xf-widget section-card space-y-4 p-6">
              <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Guest and preview modes stay
                read-only; signed-in Basic workspace limits apply immediately after approval.
              </p>
              <ul className="list-none space-y-3 text-sm text-[var(--xf-text-200)]">
                <li>
                  <Link className="font-semibold text-[var(--xf-gain-green)] hover:underline" href="/portfolios">
                    Manage portfolios &amp; accounts
                  </Link>
                  <span className="text-[var(--xf-text-400)]"> — </span>
                  switch books or add a custodian account.
                </li>
                <li>
                  <Link className="font-semibold text-[var(--xf-gain-green)] hover:underline" href={addHoldingsHref}>
                    Add holdings
                  </Link>
                  <span className="text-[var(--xf-text-400)]"> — </span>
                  paste or enter positions on your default account.
                </li>
                <li>
                  <Link className="font-semibold text-[var(--xf-gain-green)] hover:underline" href="/watchlist">
                    Watchlist CSV import
                  </Link>
                  <span className="text-[var(--xf-text-400)]"> — </span>
                  optional desk prep alongside your book.
                </li>
              </ul>

              <WorkspaceOnboardingContinue className="billing-checkout-button w-full sm:w-auto" composerDraft={composerDraft} />
            </div>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
      <GlobalFooter />
    </div>
  );
}
