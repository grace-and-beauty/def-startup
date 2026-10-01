import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Logo uploads (≤ 1 MB, docs/architecture.md §8) + multipart overhead and form fields.
      bodySizeLimit: "1200kb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          isDev: process.env.NODE_ENV === "development",
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        }),
      },
    ];
  },
};

export default nextConfig;
