import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["mongodb"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com"
      }
    ]
  },
  async redirects() {
    return [
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
