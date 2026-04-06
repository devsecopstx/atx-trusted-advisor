import { permanentRedirect } from "next/navigation";

import { isSafeOAuthReturnPath } from "@/lib/auth";

/** @deprecated `/login` is retired; forwards to `/xchat` and preserves `next` for OAuth return paths. */
export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.next;
  const next = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw[0]?.trim() ?? "" : "";
  if (next && isSafeOAuthReturnPath(next)) {
    permanentRedirect(`/xchat?next=${encodeURIComponent(next)}`);
  }
  permanentRedirect("/xchat");
}
