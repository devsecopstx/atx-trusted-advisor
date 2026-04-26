import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";

export const dynamic = "force-dynamic";

type AccessDeniedPageProps = {
  searchParams?: Promise<{ route?: string; redirect?: string }>;
};

function normalizeSafePath(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return null;
  }
  return t;
}

export default async function AccessDeniedPage(props: AccessDeniedPageProps) {
  const params = (await props.searchParams) ?? {};
  const session = await getSessionUser();
  const fallbackLanding = session ? await resolveSessionLandingPath(session) : "/xchat";
  const route = normalizeSafePath(params.route);
  const redirectTarget = normalizeSafePath(params.redirect) ?? fallbackLanding;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <section className="rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-surface-800)] p-6">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--xf-text-400)]">Access denied</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--xf-text-100)]">This route is not enabled for your role</h1>
        <p className="mt-2 text-sm text-[var(--xf-text-300)]">
          Tenant route policy blocked this request.
          {route ? (
            <>
              {" "}
              Route: <code className="font-mono text-xs">{route}</code>.
            </>
          ) : null}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="cta" href={redirectTarget}>
            Go to allowed workspace
          </Link>
          <Link className="cta cta-secondary" href="/account">
            Open account
          </Link>
        </div>
      </section>
    </main>
  );
}
