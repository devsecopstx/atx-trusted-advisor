import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { AtxFinanceLogo } from "@/app/ui/atxfinance-logo";

import { PlansLanding } from "./ui/plans-landing";
import { XchatConversation } from "./ui/xchat-conversation";
import { XchatGuestPanel } from "./ui/xchat-guest-panel";
import "./xchat.css";

function hasXfinanceAccess(roles: string[]): boolean {
  return roles.length > 0;
}

export default async function XchatPage() {
  const session = await getSessionUser();
  if (!session) {
    return (
      <div className="xchat-shell">
        <header className="xchat-header">
          <Link className="xchat-header-brand" href="/xchat">
            <AtxFinanceLogo size="sm" />
          </Link>
        </header>
        <div className="xchat-body">
          <XchatGuestPanel />
        </div>
      </div>
    );
  }

  const approved = hasXfinanceAccess(session.roles);
  const isAdmin = session.roles.includes("global_admin");

  return (
    <div className="xchat-shell">
      <header className="xchat-header">
        <Link className="xchat-header-brand" href="/xchat">
          <AtxFinanceLogo size="sm" />
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
