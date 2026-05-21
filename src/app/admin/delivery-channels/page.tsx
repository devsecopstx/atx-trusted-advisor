import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import {
    AdminDeliveryChannelsConsole,
    parseDeliveryChannelsTab
} from "./ui/admin-delivery-channels-console";

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function AdminDeliveryChannelsPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Delivery channels</h1>
        <p className="hero-copy">
          Configure platform delivery targets for operations (<strong>Channels</strong> tab), plus developer harnesses for{" "}
          <strong>xOptions</strong>, <strong>xChat ask</strong>, and <strong>test posts to X</strong>. Slack channels use an
          incoming webhook URL (<code className="font-mono text-xs">hooks.slack.com</code>). Use{" "}
          <strong>Send test</strong> for <code className="font-mono text-xs">hello from atx</code> with tenant id and
          timestamp.
        </p>
      </section>

      <Suspense fallback={<p className="status-text">Loading delivery channels…</p>}>
        <AdminDeliveryChannelsConsole initialTab={parseDeliveryChannelsTab((await searchParams)?.tab)} />
      </Suspense>
    </div>
  );
}
