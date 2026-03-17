import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { XFinanceLogo } from "@/app/ui/xfinance-logo";

import { PlansLanding } from "./ui/plans-landing";
import { XchatConversation } from "./ui/xchat-conversation";
import "./xchat.css";

function hasXfinanceAccess(roles: string[]): boolean {
  return roles.length > 0;
}

export default async function XchatPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const approved = hasXfinanceAccess(session.roles);
  const isAdmin = session.roles.includes("global_admin");

  return (
    <div className="xchat-shell">
      <header className="xchat-header">
        <Link className="xchat-header-brand" href="/xchat">
          <XFinanceLogo size="sm" />
        </Link>
        <nav className="xchat-header-nav">
          {isAdmin ? (
            <Link className="xchat-header-link" href="/admin">
              Admin
            </Link>
          ) : null}
          <Link className="xchat-header-link" href="/personas">
            Personas
          </Link>
        </nav>
      </header>

      <div className="xchat-body">
        {approved ? (
          <XchatConversation />
        ) : (
          <PlansLanding userEmail={session.email} username={session.username} />
        )}
      </div>
    </div>
  );
}
