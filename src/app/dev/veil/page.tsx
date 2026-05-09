import { notFound } from "next/navigation";

import { DevVeilClient } from "./dev-veil-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ambient Market Veil — dev preview",
  robots: { index: false, follow: false }
};

/**
 * `/dev/veil` — isolated developer preview of `<MarketVeilBackground />`.
 *
 * Production deploys gate this behind a non-development build so we never expose
 * an unbranded inspection surface; locally / in CI it lets you visually QA
 * grid breathing, particle drift, ticks, parallax, and reduced-motion without
 * the rest of the workspace chrome on top.
 */
export default function DevVeilPage() {
  if (process.env.NODE_ENV === "production" && process.env.DEV_VEIL_PREVIEW !== "1") {
    notFound();
  }
  return <DevVeilClient />;
}
