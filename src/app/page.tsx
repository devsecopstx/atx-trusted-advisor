import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { resolveSessionLandingPath } from "@/lib/default-landing-path";

export default async function HomePage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  const landing = await resolveSessionLandingPath(session);
  redirect(landing);
}
