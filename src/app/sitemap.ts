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
  { path: "/resources/guides", changeFrequency: "weekly" as const, priority: 0.65 },
  { path: "/resources/onboarding-checklist", changeFrequency: "monthly" as const, priority: 0.62 },
  { path: "/resources/about", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/decision-workflow", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/secret-sauce", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/getting-started", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/building-wheel", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/resources/building-wheel/wheel-vs-iron-condor", changeFrequency: "monthly" as const, priority: 0.5 },
  {
    path: "/resources/2026-options-income-playbook",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/how-xai-spots-better-wheels",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/cash-secured-puts-mastery",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/covered-calls-2026-balanced-income",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/leap-options-playbook",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/multi-portfolio-management-hnwi",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/options-risk-management-frameworks",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/from-xchat-to-broker-ibkr",
    changeFrequency: "monthly" as const,
    priority: 0.55,
  },
  {
    path: "/resources/top-10-hnwi-xchat-prompts",
    changeFrequency: "monthly" as const,
    priority: 0.55,
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
