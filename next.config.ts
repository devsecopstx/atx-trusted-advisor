import type { NextConfig } from "next";

import {
    DENO_SHIM_NODE_STUB_RELATIVE,
    SERVER_EXTERNAL_PACKAGES,
    STANDALONE_OUTPUT_FILE_TRACING_INCLUDES,
    buildDevOnlyAllowedOrigins
} from "./src/lib/next-build-policy";

const devOnlyAllowedOrigins = buildDevOnlyAllowedOrigins(process.env.NODE_ENV);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: [...SERVER_EXTERNAL_PACKAGES],
  turbopack: {
    resolveAlias: {
      "@deno/shim-deno": DENO_SHIM_NODE_STUB_RELATIVE
    }
  },
  ...(devOnlyAllowedOrigins ? { allowedDevOrigins: [...devOnlyAllowedOrigins] } : {}),
  /**
   * Ship runtime-spawned scripts (e.g. the Python ReportLab generator under
   * `services/report-service/**` for `POST /api/reports/options-scan`) with the
   * standalone build. Source of truth: `STANDALONE_OUTPUT_FILE_TRACING_INCLUDES`
   * in `src/lib/next-build-policy.ts`. Avoids Turbopack NFT over-tracing from a
   * literal path string in route handlers.
   */
  outputFileTracingIncludes: Object.fromEntries(
    Object.entries(STANDALONE_OUTPUT_FILE_TRACING_INCLUDES).map(([route, globs]) => [
      route,
      [...globs]
    ])
  ),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com"
      },
      {
        protocol: "https",
        hostname: "g.foolcdn.com"
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/xchat",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate"
          }
        ]
      },
      {
        source: "/xchat/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate"
          }
        ]
      }
    ];
  },
  /** Browsers request `/favicon.ico` by default; map to the same mark as `metadata.icons` (`/pwa/atx-logo-512.png`). */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/pwa/atx-logo-512.png" }];
  },
  async redirects() {
    return [
      {
        source: "/ria-white-label-platform",
        destination: "/ia-white-label-platform",
        permanent: true,
      },
      {
        source: "/app_user/xoptions",
        destination: "/xoptions",
        permanent: true
      },
      {
        source: "/app_user/xoptions/:path*",
        destination: "/xoptions",
        permanent: true
      },
      {
        source: "/admin/user-settings",
        destination: "/admin/manage-users",
        permanent: true
      },
      {
        source: "/recommendations",
        destination: "/admin/recommendations",
        permanent: false
      },
      {
        source: "/recommendations/:path*",
        destination: "/admin/recommendations",
        permanent: false
      },
      {
        source: "/xstrategybuilder",
        destination: "/xoptions",
        permanent: false
      },
      {
        source: "/xstrategybuilder/:path*",
        destination: "/xoptions",
        permanent: false
      }
    ];
  }
};

async function buildNextConfig(): Promise<NextConfig> {
  if (process.env.ANALYZE === "true") {
    const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
    return bundleAnalyzer({ enabled: true })(nextConfig);
  }
  return nextConfig;
}

export default buildNextConfig();
