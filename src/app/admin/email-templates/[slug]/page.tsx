import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isEmailTemplateSlug } from "@/modules/email-templates/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminEmailTemplateEditor } from "../ui/email-template-editor";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scope?: string }>;
};

export default async function AdminEmailTemplateEditorPage({ params, searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { slug } = await params;
  if (!isEmailTemplateSlug(slug)) {
    redirect("/admin/email-templates?error=unknown_slug");
  }
  const { scope } = await searchParams;
  const editScope: "global" | "tenant" = scope === "global" ? "global" : "tenant";

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Edit email template</h1>
        <p className="hero-copy">
          <code className="font-mono text-xs">{slug}</code> · scope{" "}
          <strong>{editScope === "global" ? "global default (tenantId: null)" : "tenant"}</strong>
        </p>
      </section>
      <AdminEmailTemplateEditor slug={slug} scope={editScope} />
    </div>
  );
}
