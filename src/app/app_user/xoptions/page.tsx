import Hero from "@/app/ui/pitch-hero";

/**
 * xoptions pitch deck — public app_user surface.
 * Styling uses the repo Tailwind pipeline (see tailwind / PostCSS); no CDN script required in App Router.
 */
export default function XoptionsPitchPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Hero title="xoptions" contactEmail="sperezintexas@gmail.com" />
    </div>
  );
}
