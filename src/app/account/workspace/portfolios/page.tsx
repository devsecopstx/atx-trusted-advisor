import { permanentRedirect } from "next/navigation";

/** Legacy URL — canonical route is `/workspace/portfolios`. */
export default function LegacyAccountWorkspacePortfoliosRedirect() {
  permanentRedirect("/workspace/portfolios");
}
