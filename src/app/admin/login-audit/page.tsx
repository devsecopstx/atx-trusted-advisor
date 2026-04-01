import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { LoginAuditConsole } from "./ui/login-audit-console";

export default async function AdminLoginAuditPage() {
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
        <h1 className="hero-title">Login audit</h1>
        <p className="hero-copy">
          Successful and failed sign-in attempts with client IP and timestamps for abuse review. Data is stored in the{" "}
          <code className="text-[var(--xf-gain-green)]">audit_login</code> collection.
        </p>
        <p className="mt-2 text-sm text-[var(--xf-text-muted)]">
          <Link href="/admin/audit" className="text-[var(--xf-gain-green)] underline">
            Audit explorer
          </Link>{" "}
          covers change trails; this view is dedicated to authentication attempts.
        </p>
      </section>

      <LoginAuditConsole />
    </div>
  );
}
