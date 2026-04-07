import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

import { XoptionsStrategyBuilderMount } from "./xoptions-strategy-builder-mount";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string; details?: string }>;
};

export default async function XoptionsPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const authError = typeof sp.error === "string" ? sp.error : undefined;
  const authDetails = typeof sp.details === "string" ? sp.details : undefined;
  const pendingXHandle =
    authError === "email_link_required" ? (await readPendingXLinkCookie())?.username : undefined;

  if (!session || !canUserLogin(session.roles)) {
    return (
      <ProductGuestShell
        authDetails={authDetails}
        authError={authError}
        blurb={
          <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
            Sign in to open the xOptions strategy builder: pick a symbol, horizon, and{" "}
            <strong className="text-[var(--xf-text-200)]">Choose contract</strong> for covered calls, cash-secured
            puts, and other single-leg strategies — without leaving this URL.
          </p>
        }
        nextPath="/xoptions"
        pendingXHandle={pendingXHandle}
        session={session}
      />
    );
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xoptions" feedbackPageLabel="xOptions" session={session} />
      <div className="xchat-body px-4 py-6 md:px-8">
        <AppUserCollapsibleRailLayout
          rail={<AppUserAccountPublicRailForSession railVariant="workspace-product" session={session} />}
        >
          <XoptionsStrategyBuilderMount />
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
