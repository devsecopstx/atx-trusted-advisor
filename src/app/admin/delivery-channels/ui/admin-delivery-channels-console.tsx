"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { AdminDeliveryChannelsCrud } from "@/app/admin/delivery-channels/ui/admin-delivery-channels-crud";
import { AdminXchatApiTestPanel } from "@/app/admin/delivery-channels/ui/admin-xchat-api-test-panel";
import { TestPostXPanel } from "@/app/admin/test-post-x/ui/test-post-x-panel";
import { StrategyOptionsConsole } from "@/app/xstrategybuilder/strategy-options/strategy-options-console";

export const DELIVERY_CHANNELS_TABS = [
  { id: "channels", label: "Channels" },
  { id: "xoptions", label: "xOptions API test" },
  { id: "xchat-api", label: "xChat API test" },
  { id: "test-post-x", label: "Test post to X" }
] as const;

export type DeliveryChannelsTabId = (typeof DELIVERY_CHANNELS_TABS)[number]["id"];

const TAB_IDS = new Set<string>(DELIVERY_CHANNELS_TABS.map((t) => t.id));

export function parseDeliveryChannelsTab(value: string | null | undefined): DeliveryChannelsTabId {
  const raw = (value ?? "").trim();
  if (TAB_IDS.has(raw)) {
    return raw as DeliveryChannelsTabId;
  }
  return "channels";
}

type AdminDeliveryChannelsConsoleProps = {
  initialTab?: DeliveryChannelsTabId;
};

export function AdminDeliveryChannelsConsole({
  initialTab = "channels"
}: AdminDeliveryChannelsConsoleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseDeliveryChannelsTab(searchParams.get("tab") ?? initialTab);

  function selectTab(tab: DeliveryChannelsTabId) {
    const next = tab === "channels" ? "/admin/delivery-channels" : `/admin/delivery-channels?tab=${tab}`;
    router.replace(next, { scroll: false });
  }

  return (
    <section className="panel stack-gap">
      <div
        className="portfolio-edit-holdings-mode"
        role="tablist"
        aria-label="Delivery channels and developer tools"
        style={{ marginBottom: "0.75rem" }}
      >
        {DELIVERY_CHANNELS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`portfolio-edit-holdings-mode__btn${
              activeTab === tab.id ? " portfolio-edit-holdings-mode__btn--active" : ""
            }`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "channels" ? <AdminDeliveryChannelsCrud /> : null}

      {activeTab === "xoptions" ? (
        <article className="surface-card xf-widget section-card stack-gap">
          <p className="status-text m-0">
            Read-only GET harness for Yahoo-backed{" "}
            <code className="font-mono text-xs">/api/strategy-options/expirations</code> and{" "}
            <code className="font-mono text-xs">/api/strategy-options</code>. Verify BFF ↔ backend parity and
            payloads.
          </p>
          <StrategyOptionsConsole
            backHref="/admin/delivery-channels"
            backLabel="Back to delivery channels"
            eyebrow="admin · xOptions (strategy-options)"
          />
        </article>
      ) : null}

      {activeTab === "xchat-api" ? <AdminXchatApiTestPanel /> : null}

      {activeTab === "test-post-x" ? (
        <article className="surface-card xf-widget section-card stack-gap">
          <p className="status-text m-0">
            Send a one-off post through the X API v2 tweet endpoint. Connect OAuth below (or use legacy{" "}
            <code className="font-mono text-xs">X_OAUTH_REFRESH_TOKEN</code>) with{" "}
            <code className="font-mono text-xs">X_OAUTH_CLIENT_ID</code> /{" "}
            <code className="font-mono text-xs">X_OAUTH_CLIENT_SECRET</code>.
          </p>
          <TestPostXPanel returnPath="/admin/delivery-channels?tab=test-post-x" />
        </article>
      ) : null}
    </section>
  );
}
