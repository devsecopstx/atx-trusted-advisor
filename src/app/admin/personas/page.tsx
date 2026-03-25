import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getTenantPortfolioOrgKey } from "@/modules/core-admin/tenant-portfolio-org";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { defaultTrustedAdvisorXpersonasCollectionDisplayName } from "@/modules/xchat/trusted-advisor-xpersonas-collection";

import { PersonasOnboardingHome } from "./ui/personas-onboarding-home";

export default async function AdminPersonasPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden&target=personas");
  }

  const tenantOrgId = getTenantPortfolioOrgKey();

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">xPersona Config</h1>
        <p className="hero-copy">
          Manage xPersona prompts, tools, and collection bindings.
        </p>
        <p className="hero-copy" style={{ marginTop: "0.65rem" }}>
          <strong>This instance</strong> — tenant org ID{" "}
          <code className="font-mono text-xs break-all">{tenantOrgId}</code>
          {" · "}tenant ID (Mongo / <code className="font-mono text-xs">core_tenants</code>){" "}
          <code className="font-mono text-xs break-all">{session.tenantId}</code>
        </p>
      </section>

      <PersonasOnboardingHome
        defaultXpersonasCollectionDisplayName={defaultTrustedAdvisorXpersonasCollectionDisplayName()}
      />
    </div>
  );
}
