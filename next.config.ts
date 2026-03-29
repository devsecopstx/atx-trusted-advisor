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
        hostname: "pbs.twimg.com"
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
  async redirects() {
    return [
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
      }
    ];
  }
};

export default nextConfig;
