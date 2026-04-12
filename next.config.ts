import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["mongodb", "redis"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons*"
      },
      {
        protocol: "https",
        hostname: "images.financialmodelingprep.com",
        pathname: "/symbol/**"
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
  /** Browsers request `/favicon.ico` by default; map to the same mark as `metadata.icons` (`/branding/aTx.png`). */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/branding/aTx.png" }];
  },
  async redirects() {
    return [
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

export default nextConfig;
