import type { MetadataRoute } from "next";

// Base URL for canonical links
const BASE_URL = "https://atxtrustedadvisory.com";

// Central list of public, marketing/guest pages to include in the sitemap
// Only include pages that are accessible without authentication and are intended for SEO indexing.
const publicRoutes = [
  {
    path: "/",
    changeFrequency: "weekly" as const,
    priority: 1.0,
  },
  {
    path: "/xchat",
    changeFrequency: "weekly" as const,
    priority: 0.8,
  },
  // Resources (public, guest-accessible)
  { path: "/resources/about", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/decision-workflow", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/secret-sauce", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/getting-started", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/building-wheel", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/building-wheel/wheel-vs-iron-condor", changeFrequency: "monthly" as const, priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date().toISOString();

  return publicRoutes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
