"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BillingAccessAccountRailStatus } from "@/app/ui/billing-access-account-rail-status";
import { GoogleGIcon } from "@/app/ui/oauth-provider-icons";
import { PwaInstallAccountPrompt } from "@/app/ui/pwa-install-account-prompt";
import { RailUserFeedbackDialog } from "@/app/ui/rail-user-feedback-dialog";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { tenantIdHexLastFourUserFacing } from "@/lib/mongo-object-id-hex";
import { SUBSCRIPTION_PLAN_LABELS, type SubscriptionPlan } from "@/lib/subscription-plan";
import { USER_FEEDBACK_OPEN_EVENT } from "@/lib/user-feedback-open-event";

export type AppUserRailAccountPanelDetails = {
  email: string;
  username: string;
  displayName?: string;
  xUserId: string;
  avatarUrl?: string;
  mongoConnection?: string;
  /** Session `core_tenants` ObjectId hex; UI shows last 4 chars only (`···` prefix); full id in `title`. */
  tenantIdHex?: string;
  /** From `core_users.subscriptionPlan` (normalized). */
  subscriptionPlan: SubscriptionPlan;
  isGlobalAdmin: boolean;
  /** Highest platform role for sidebar tenant label, e.g. `advisor`. */
  platformRole?: string | null;
};

type AppUserRailAccountPanelProps = {
  details: AppUserRailAccountPanelDetails;
  /** Overrides pathname-derived label for feedback API `page` field. */
  feedbackPageLabel?: string;
  /** When set, adds “Link Google” (same verified email as profile) for X-first sign-in. */
  googleLinkHref?: string | null;
  /** Hide Settings / Plans / Legal shortcuts when duplicated in the workspace Resources section. */
  hideShortcutLinks?: boolean;
};

export function AppUserRailAccountPanel({
  details,
  feedbackPageLabel,
  googleLinkHref = null,
  hideShortcutLinks = false
}: AppUserRailAccountPanelProps) {
  const pathname = usePathname() ?? "";
  const pageLabel = feedbackPageLabel?.trim() || pathname || "App";

  const { email, username, displayName, xUserId, mongoConnection, tenantIdHex, subscriptionPlan, isGlobalAdmin } =
    details;
  const mongoHref =
    mongoConnection && mongoConnection.includes("://")
      ? mongoConnection
      : mongoConnection
        ? `mongodb://${mongoConnection}`
        : null;
  const tenantTrimmed = tenantIdHex?.trim() ?? "";
  const showDatabaseDisclosure = Boolean((mongoConnection && mongoHref) || tenantTrimmed);

  return (
    <div className="app-user-rail-account-panel">
      <RailUserFeedbackDialog pageLabel={pageLabel} />

      <div className="app-user-rail-account-panel__identity">
        <div className="app-user-rail-account-panel__identity-text">
          <p className="app-user-rail-account-panel__name">{displayName ?? username}</p>
          <p className="app-user-rail-account-panel__handle">@{username}</p>
        </div>
      </div>

      <p className="app-user-rail-account-panel__meta">
        <span className="app-user-rail-account-panel__meta-k">Email</span>
        <span className="app-user-rail-account-panel__meta-v">{email}</span>
      </p>
      <p className="app-user-rail-account-panel__meta">
        <span className="app-user-rail-account-panel__meta-k">X user id</span>
        <span className="app-user-rail-account-panel__meta-v font-mono text-[0.65rem]">{xUserId}</span>
      </p>
      <p className="app-user-rail-account-panel__meta">
        <span className="app-user-rail-account-panel__meta-k">Plan</span>
        <span className="app-user-rail-account-panel__meta-v">{SUBSCRIPTION_PLAN_LABELS[subscriptionPlan]}</span>
      </p>

      <BillingAccessAccountRailStatus />

      {showDatabaseDisclosure ? (
        <details className="app-user-rail-account-panel__db">
          <summary className="app-user-rail-account-panel__db-summary">
            <span className="app-user-rail-account-panel__meta-k">Database</span>
          </summary>
          <div className="app-user-rail-account-panel__db-body">
            {tenantTrimmed ? (
              <p className="app-user-rail-account-panel__meta app-user-rail-account-panel__meta--tenant-id">
                <span className="app-user-rail-account-panel__meta-k">Tenant id</span>
                <span
                  className="app-user-rail-account-panel__meta-v font-mono text-[0.65rem] break-all"
                  title={tenantTrimmed}
                >
                  {tenantIdHexLastFourUserFacing(tenantTrimmed)}
                </span>
              </p>
            ) : null}
            {mongoConnection && mongoHref ? (
              <a className="app-user-rail-account-panel__code app-user-rail-account-panel__code-link" href={mongoHref}>
                {mongoConnection}
              </a>
            ) : null}
          </div>
        </details>
      ) : null}

      {hideShortcutLinks ? (
        <div className="app-user-rail-account-panel__pwa-only">
          <PwaInstallAccountPrompt />
        </div>
      ) : (
        <nav className="app-user-rail-account-panel__nav" aria-label="Account shortcuts">
          {isGlobalAdmin ? (
            <Link className="app-user-rail-sublink" href="/admin/manage_account">
              Settings
            </Link>
          ) : (
            <span className="app-user-rail-sublink app-user-rail-sublink--muted" role="note" tabIndex={0}>
              Settings (Hub admin)
            </span>
          )}
          {googleLinkHref ? (
            <XfHoverHint hint="Uses the same verified email as your aTx Advisor profile.">
              <Link className="app-user-rail-sublink app-user-rail-sublink--oauth" href={googleLinkHref}>
                <GoogleGIcon className="inline-block align-[-0.12em] opacity-90" size={14} />
                <span className="ml-1">Link Google</span>
              </Link>
            </XfHoverHint>
          ) : null}
          <Link className="app-user-rail-sublink" href="/account/billing">
            Plans &amp; billing
          </Link>
          <Link className="app-user-rail-sublink" href="/legal/terms">
            Legal
          </Link>
          <PwaInstallAccountPrompt />
        </nav>
      )}

      <div className="app-user-rail-account-panel__actions">
        <button
          className="app-user-rail-account-panel__btn"
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(USER_FEEDBACK_OPEN_EVENT))}
        >
          Submit feedback
        </button>
      </div>
    </div>
  );
}
