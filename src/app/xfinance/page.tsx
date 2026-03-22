import { permanentRedirect } from "next/navigation";

/** Legacy URL; canonical app_user portfolio surface is `/portfolio`. */
export default function LegacyXfinancePathRedirect() {
  permanentRedirect("/portfolio");
}
