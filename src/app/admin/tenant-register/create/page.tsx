import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { CreateTenantConsole } from "./ui/create-tenant-console";

export default async function AdminCreateTenantPage() {
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
        <h1 className="hero-title">Create tenant</h1>
        <p className="hero-copy">
          Upserts <code className="text-sm">core_tenants</code> and optionally provisions{" "}
          <code className="text-sm">initialTenantAdmin</code> — same contract as{" "}
          <code className="text-sm">npm run generate:tenant-spec</code> +{" "}
          <code className="text-sm">npm run seed:tenant -- --file tenant-specs/&lt;slug&gt;.yaml</code>, applied to{" "}
          <strong>this</strong> app database (no YAML file on disk). Optional **accent palette** and **hero icon** (
          URL or embedded image) map to <code className="text-sm">tenantPreferences</code>. After success, open{" "}
          <Link className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline" href="/admin/tenant-register">
            Tenant register
          </Link>{" "}
          to verify.
        </p>
      </section>

      <CreateTenantConsole />
    </div>
  );
}
