import type { NextConfig } from "next";

const configuredApiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const apiDestination = configuredApiUrl.replace(/\/$/, "").endsWith("/api")
  ? `${configuredApiUrl.replace(/\/$/, "")}/:path*/`
  : `${configuredApiUrl.replace(/\/$/, "")}/api/:path*/`;

const nextConfig: NextConfig = {
  output: "standalone",
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: apiDestination,
      },
    ];
  },
};

export default nextConfig;
