import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

import { IbkrConnectPanel } from "./ibkr-connect-panel";

export const metadata: Metadata = {
  title: "IBKR integration"
};

export default async function IbkrIntegrationPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/account/integrations/ibkr");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <nav className="mb-6 font-mono text-xs text-[var(--xf-text-muted,#94a3b8)]">
        <Link href="/account/billing" className="text-[var(--xf-gain-green,#39ff14)] hover:underline">
          Account
        </Link>
        <span className="mx-2">/</span>
        <span>IBKR</span>
      </nav>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-[var(--xf-text-primary,#f1f5f9)]">
        Interactive Brokers
      </h1>
      <IbkrConnectPanel />
    </main>
  );
}
