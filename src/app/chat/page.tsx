import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { listPersonas } from "@/modules/xchat/repository";

import { type XchatTestPersonaOption, XchatTestConsole } from "./ui/xchat-test-console";

export default async function ChatTestPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  const personaDocs = await listPersonas();
  const initialPersonas: XchatTestPersonaOption[] = personaDocs.map((p) => ({
    _id: p._id?.toHexString(),
    name: p.name,
    model: p.model,
    defaultScope: p.defaultScope
  }));

  return (
    <div className="core-shell">
      <nav aria-label="Test harness navigation" className="tool-row">
        <Link className="admin-topbar-link" href="/admin">
          ← Admin hub
        </Link>
        <span aria-hidden className="status-text">
          ·
        </span>
        <Link className="admin-topbar-link" href="/admin/batch">
          Batch Ops
        </Link>
      </nav>
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">global_admin · test harness</p>
        <h1 className="hero-title">xChat test (`/chat`)</h1>
        <p className="hero-copy">
          Single-message `POST /api/xchat/ask` with optional persona id — same API as product `/xchat`, without
          the full chat UI.
        </p>
      </section>

      <XchatTestConsole initialPersonas={initialPersonas} />
    </div>
  );
}
