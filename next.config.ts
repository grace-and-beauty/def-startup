import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Logo uploads (≤ 1 MB, docs/architecture.md §8) + multipart overhead and form fields.
      bodySizeLimit: "1200kb",
    },
  },
};

export default nextConfig;
