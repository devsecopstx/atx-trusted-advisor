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
  {
    path: "/xoptions",
    changeFrequency: "weekly" as const,
    priority: 0.8,
  },
  {
    path: "/portfolios",
    changeFrequency: "weekly" as const,
    priority: 0.8,
  },
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
