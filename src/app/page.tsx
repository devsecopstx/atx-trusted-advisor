import { DEFAULT_POST_LOGIN, HomeLanding } from "@/app/ui/home-landing";
import { isGoogleOAuthConfigured } from "@/lib/env";

export default function HomePage() {
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent(DEFAULT_POST_LOGIN)}`
    : null;

  return <HomeLanding googleLoginHref={googleLoginHref} />;
}
