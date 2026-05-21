import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminPlatformInternals } from "../ui/admin-platform-internals";

export default async function AdminPlatformHealthPage() {
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
        <h1 className="hero-title">Platform health</h1>
        <p className="hero-copy">
          Ops summary, data-plane registry, backend reachability, and tenant UX drills — moved off the main hub for a
          cleaner launchpad.
        </p>
      </section>
      <AdminPlatformInternals defaultOpen showFullPageLink={false} />
    </div>
  );
}
