import { permanentRedirect } from "next/navigation";

/** @deprecated Canonical route is `/portfolios`. */
export default function LegacyAccountWorkspacePortfoliosRedirectPage() {
  permanentRedirect("/portfolios");
}
