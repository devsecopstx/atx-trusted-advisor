import { permanentRedirect } from "next/navigation";

/** @deprecated Use `/account/workspace-preferences`. */
export default function LegacyAccountComplianceRedirectPage() {
  permanentRedirect("/account/workspace-preferences");
}
