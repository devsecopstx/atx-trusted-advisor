import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminDeliveryChannelsCrud } from "./ui/admin-delivery-channels-crud";

export default async function AdminDeliveryChannelsPage() {
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
          Configure platform delivery targets for operations: <strong>in-app</strong> (saved for future routing) or{" "}
          <strong>Slack</strong> using an incoming webhook URL (<code className="font-mono text-xs">hooks.slack.com</code>
          ). Use <strong>Send test</strong> to send a line that includes <code className="font-mono text-xs">hello from atx</code>, your{" "}
          <strong>tenant id</strong>, and an <strong>ISO timestamp</strong> to Slack/email, or preview in-app.
        </p>
      </section>

      <AdminDeliveryChannelsCrud />
    </div>
  );
}
