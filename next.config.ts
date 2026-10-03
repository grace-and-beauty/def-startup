import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security/headers";

const isDev = process.env.NODE_ENV === "development";
// Dev only: testing from a phone through a Cloudflare quick tunnel (`cloudflared tunnel --url`).
const devTunnelHosts = isDev ? ["*.trycloudflare.com"] : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: devTunnelHosts,
  experimental: {
    serverActions: {
      // Logo uploads (≤ 1 MB, docs/architecture.md §8) + multipart overhead and form fields.
      bodySizeLimit: "1200kb",
      allowedOrigins: devTunnelHosts,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          isDev,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        }),
      },
    ];
  },
};

export default nextConfig;
