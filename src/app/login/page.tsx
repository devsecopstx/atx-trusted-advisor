import { permanentRedirect } from "next/navigation";

/** @deprecated `/login` is retired; use `/xchat` as the only auth entrypoint. */
export default function LoginPage() {
  permanentRedirect("/xchat");
}
