import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { XchatConsole } from "./ui/xchat-console";

export default async function AdminXchatPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden&target=xchat");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">xfinance core admin</p>
        <h1 className="hero-title">xchat Ask</h1>
        <p className="hero-copy">
          Test xchat responses with persona selection from a focused single-purpose page.
        </p>
      </section>

      <XchatConsole />
    </div>
  );
}
