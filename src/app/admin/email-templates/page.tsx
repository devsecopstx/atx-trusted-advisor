import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminEmailTemplatesList } from "./ui/email-templates-list";

export default async function AdminEmailTemplatesPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden&target=email-templates");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Email templates</h1>
        <p className="hero-copy">
          Edit weekly + daily portfolio digest templates. Templates use a small fixed{" "}
          <strong>Mustache</strong> variable set rendered at send time, plus <strong>Markdown</strong>{" "}
          formatting. Per-portfolio overrides live at{" "}
          <code className="font-mono text-xs">/admin/portfolios/&lt;id&gt;/email-preferences</code>.
        </p>
        <p className="hero-copy" style={{ marginTop: "0.65rem" }}>
          Allowed variables:{" "}
          <code className="font-mono text-xs">{"{{portfolio.name}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{period.start}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{period.end}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{totalValue}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{weekChange}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{dayChange}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{narrative}}"}</code>, and sections{" "}
          <code className="font-mono text-xs">{"{{#events}}…{{/events}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{#positions}}…{{/positions}}"}</code>,{" "}
          <code className="font-mono text-xs">{"{{#topMovers}}…{{/topMovers}}"}</code>.
        </p>
      </section>

      <AdminEmailTemplatesList />
    </div>
  );
}
